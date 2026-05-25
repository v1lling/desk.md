// Email drop view (macOS)
// -----------------------
// A native Cocoa view attached above the WKWebView in Desk's main window.
// Claims drags that carry a file promise (Apple Mail, Outlook for Mac),
// materializes them into a temp dir, and reports the resulting path back to
// Rust via a C callback. Direct file-URL drops (Thunderbird, Finder) bypass
// this view and route through Tauri's built-in `onDragDropEvent`.
//
// Two promise APIs coexist:
//   - Modern (`NSFilePromiseReceiver`) — Outlook for Mac. Clean completion
//     callback with the resolved file URL.
//   - Legacy (`namesOfPromisedFilesDroppedAtDestination:`) — Apple Mail.
//     Deprecated since 10.13 but still the only way to trigger Apple Mail
//     to write the file. No completion callback — we use FSEvents on the
//     destination dir to detect when the .eml lands.
//
// `performDragOperation:` picks exactly ONE path per drop (see comment at
// the branch for why we don't run both).
//
// Reference: https://github.com/skyeewers/DropTestArticle

#import <AppKit/AppKit.h>
#import <Foundation/Foundation.h>
#import <CoreServices/CoreServices.h>

typedef void (*desk_drop_state_cb)(void* user_data);
typedef void (*desk_drop_path_cb)(const char* path, void* user_data);

static const NSTimeInterval kDropResolveTimeoutSeconds = 15.0;

// Apple Mail's legacy promise comes through under one of these pasteboard type
// names depending on macOS / Mail version. We treat any of them as "legacy".
static NSString* const kLegacyFilesPromisePboardType = @"NSFilesPromisePboardType";
static NSString* const kPromiseUrlPboardType        = @"com.apple.pasteboard.promised-file-url";
static NSString* const kPromiseContentPboardType    = @"com.apple.pasteboard.promised-file-content-type";

static BOOL DeskPasteboardHasLegacyPromise(NSArray<NSString*>* types) {
    return [types containsObject:kLegacyFilesPromisePboardType]
        || [types containsObject:kPromiseUrlPboardType]
        || [types containsObject:kPromiseContentPboardType];
}

// FSEvents callback (a C function — FSEventStreamCallback can't be a block).
// `clientCallBackInfo` holds the retained `void (^)(NSString*)` block from the
// legacy branch of `performDragOperation:`; we call it with the first .eml we see.
static void DeskFSEventsCallback(
    ConstFSEventStreamRef streamRef __unused,
    void* clientCallBackInfo,
    size_t numEvents,
    void* eventPaths,
    const FSEventStreamEventFlags eventFlags[] __unused,
    const FSEventStreamEventId eventIds[] __unused
) {
    void (^report)(NSString*) = (__bridge void (^)(NSString*))clientCallBackInfo;
    char** paths = (char**)eventPaths;
    for (size_t i = 0; i < numEvents; i++) {
        NSString* p = [NSString stringWithUTF8String:paths[i]];
        BOOL isDir = NO;
        if ([[NSFileManager defaultManager] fileExistsAtPath:p isDirectory:&isDir] && isDir) {
            NSArray<NSString*>* entries =
                [[NSFileManager defaultManager] contentsOfDirectoryAtPath:p error:nil];
            for (NSString* name in entries) {
                if ([[name pathExtension] caseInsensitiveCompare:@"eml"] == NSOrderedSame) {
                    report([p stringByAppendingPathComponent:name]);
                    return;
                }
            }
        } else if ([[p pathExtension] caseInsensitiveCompare:@"eml"] == NSOrderedSame) {
            report(p);
            return;
        }
    }
}

@interface DeskEmailDropView : NSView
@property (nonatomic, copy) NSURL* destDir;
@property (nonatomic, assign) void* userData;
@property (nonatomic, assign) desk_drop_state_cb onEnter;
@property (nonatomic, assign) desk_drop_state_cb onLeave;
@property (nonatomic, assign) desk_drop_path_cb onDrop;
@end

@implementation DeskEmailDropView

// Pass non-drag mouse events through to the WKWebView underneath.
- (NSView*)hitTest:(NSPoint)point {
    return nil;
}

- (BOOL)acceptsFirstMouse:(NSEvent*)event {
    return NO;
}

// --- NSDraggingDestination ---

- (BOOL)pasteboardHasEmail:(NSPasteboard*)pb {
    if ([pb canReadObjectForClasses:@[ NSFilePromiseReceiver.class ] options:nil]) return YES;
    if (DeskPasteboardHasLegacyPromise([pb types])) return YES;
    // The drag reached us because we register for `public.url` so Apple Mail's
    // drag routes here at all; without a file promise there's nothing to import.
    return NO;
}

- (NSDragOperation)draggingEntered:(id<NSDraggingInfo>)sender {
    if (![self pasteboardHasEmail:[sender draggingPasteboard]]) {
        return NSDragOperationNone;
    }
    if (self.onEnter) self.onEnter(self.userData);
    return NSDragOperationCopy;
}

- (void)draggingExited:(id<NSDraggingInfo>)sender {
    if (self.onLeave) self.onLeave(self.userData);
}

- (BOOL)prepareForDragOperation:(id<NSDraggingInfo>)sender {
    return [self pasteboardHasEmail:[sender draggingPasteboard]];
}

- (BOOL)performDragOperation:(id<NSDraggingInfo>)sender {
    NSPasteboard* pb = [sender draggingPasteboard];
    NSArray<NSFilePromiseReceiver*>* receivers =
        [pb readObjectsForClasses:@[ NSFilePromiseReceiver.class ] options:nil];
    BOOL hasLegacy = DeskPasteboardHasLegacyPromise([pb types]);
    if (receivers.count == 0 && !hasLegacy) return NO;

    NSURL* dest = [self destDir];
    if (!dest) return NO;

    void* userData = self.userData;
    desk_drop_path_cb onDrop = self.onDrop;
    desk_drop_state_cb onLeave = self.onLeave;
    if (onLeave) onLeave(userData);

    // Pick exactly ONE API per drop. Outlook for Mac advertises BOTH the
    // modern receiver and the legacy pasteboard types. Calling both leaves
    // Outlook's writer confused — the modern reader's reported file ends up
    // missing while the OS spams "Couldn't get a copy of an HFS Promise from
    // the pasteboard". Modern wins if available; legacy is the Apple Mail
    // fallback only.
    if (receivers.count > 0) {
        // --- Modern path (Outlook for Mac, anything adopted post-10.12) ---
        __block dispatch_once_t once = 0;
        NSOperationQueue* queue = [[NSOperationQueue alloc] init];
        queue.qualityOfService = NSQualityOfServiceUserInitiated;
        for (NSFilePromiseReceiver* receiver in receivers) {
            [receiver receivePromisedFilesAtDestination:dest
                                                options:@{}
                                         operationQueue:queue
                                                 reader:^(NSURL* fileURL, NSError* error) {
                if (error || !fileURL) return;
                dispatch_once(&once, ^{
                    if (onDrop) onDrop([[fileURL path] UTF8String], userData);
                });
            }];
        }
        return YES;
    }

    // --- Legacy path (Apple Mail) ---
    // `namesOfPromisedFilesDroppedAtDestination:` triggers Apple Mail to write
    // the file but provides no completion callback, so we watch the destination
    // dir with FSEvents and report the path the moment the .eml lands.
    __block dispatch_once_t legacyOnce = 0;
    __block FSEventStreamRef stream = NULL;
    void (^report)(NSString*) = ^(NSString* path) {
        dispatch_once(&legacyOnce, ^{
            if (stream) {
                FSEventStreamStop(stream);
                FSEventStreamInvalidate(stream);
                FSEventStreamRelease(stream);
                stream = NULL;
            }
            if (onDrop && path) onDrop([path UTF8String], userData);
        });
    };

    NSString* destPath = [dest path];
    FSEventStreamContext ctx = {0};
    ctx.info = (__bridge_retained void*)[report copy];
    ctx.release = (CFAllocatorReleaseCallBack)CFRelease;

    // Do NOT add kFSEventStreamCreateFlagUseCFTypes — DeskFSEventsCallback
    // treats `eventPaths` as `char**`. With CFTypes it would be a CFArrayRef
    // of CFStringRef and the cast yields garbage paths. NoDefer fires the
    // first event immediately instead of holding it in the latency window.
    stream = FSEventStreamCreate(
        NULL, DeskFSEventsCallback, &ctx,
        (__bridge CFArrayRef)@[ destPath ],
        kFSEventStreamEventIdSinceNow, 0.1,
        kFSEventStreamCreateFlagFileEvents | kFSEventStreamCreateFlagNoDefer
    );
    if (stream) {
        FSEventStreamSetDispatchQueue(stream, dispatch_get_main_queue());
        FSEventStreamStart(stream);
    }

    #pragma clang diagnostic push
    #pragma clang diagnostic ignored "-Wdeprecated-declarations"
    (void)[sender namesOfPromisedFilesDroppedAtDestination:dest];
    #pragma clang diagnostic pop

    // Safety net: stop watching after the timeout so the stream never leaks.
    dispatch_after(
        dispatch_time(DISPATCH_TIME_NOW, (int64_t)(kDropResolveTimeoutSeconds * NSEC_PER_SEC)),
        dispatch_get_main_queue(),
        ^{
            dispatch_once(&legacyOnce, ^{
                if (stream) {
                    FSEventStreamStop(stream);
                    FSEventStreamInvalidate(stream);
                    FSEventStreamRelease(stream);
                    stream = NULL;
                }
            });
        }
    );

    return YES;
}

@end

/// Install the drop view above the WKWebView in the given NSWindow. Idempotent.
void desk_install_drop_view(
    void* ns_window,
    desk_drop_state_cb on_enter,
    desk_drop_state_cb on_leave,
    desk_drop_path_cb on_drop,
    void* user_data
) {
    if (!ns_window) return;
    NSWindow* window = (__bridge NSWindow*)ns_window;
    NSView* contentView = window.contentView;
    if (!contentView) return;

    // Idempotent: if our subclass is already a subview, just refresh callbacks.
    for (NSView* sub in contentView.subviews) {
        if ([sub isKindOfClass:[DeskEmailDropView class]]) {
            DeskEmailDropView* existing = (DeskEmailDropView*)sub;
            existing.onEnter = on_enter;
            existing.onLeave = on_leave;
            existing.onDrop = on_drop;
            existing.userData = user_data;
            return;
        }
    }

    DeskEmailDropView* view = [[DeskEmailDropView alloc] initWithFrame:contentView.bounds];
    view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    view.onEnter = on_enter;
    view.onLeave = on_leave;
    view.onDrop = on_drop;
    view.userData = user_data;

    // Wipe the temp drop dir on each install so we never see " 2"-suffixed
    // filenames from a name collision against a stale `.eml` left behind by
    // a crash or interrupted import.
    NSString* dropDir = [NSTemporaryDirectory() stringByAppendingPathComponent:@"desk-drops"];
    [[NSFileManager defaultManager] removeItemAtPath:dropDir error:nil];
    [[NSFileManager defaultManager] createDirectoryAtPath:dropDir
                              withIntermediateDirectories:YES
                                               attributes:nil
                                                    error:nil];
    view.destDir = [NSURL fileURLWithPath:dropDir isDirectory:YES];

    // Critical: register for `public.url` (NSPasteboardTypeURL). Apple Mail
    // puts a `message:` URL on the drag pasteboard and none of the file-promise
    // types directly, so without this the drag would bypass us and go to
    // WKWebView (which can't extract a file). pasteboardHasEmail: then filters
    // to only accept drags that also carry a promise.
    NSMutableArray<NSString*>* draggedTypes =
        [NSMutableArray arrayWithArray:[NSFilePromiseReceiver readableDraggedTypes]];
    [draggedTypes addObject:kLegacyFilesPromisePboardType];
    [draggedTypes addObject:kPromiseUrlPboardType];
    [draggedTypes addObject:kPromiseContentPboardType];
    [draggedTypes addObject:NSPasteboardTypeURL];
    [view registerForDraggedTypes:draggedTypes];

    [contentView addSubview:view positioned:NSWindowAbove relativeTo:nil];
}
