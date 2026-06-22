// Email + generic file drop view (macOS)
// ---------------------------------------
// A native Cocoa view attached above the WKWebView in Desk's main window.
// Two responsibilities, dispatched per-drop:
//
//   1. Email file promises — Apple Mail (legacy `NSFilesPromisePboardType`)
//      and Outlook for Mac (modern `NSFilePromiseReceiver`). Materializes
//      the message into a temp dir and reports the resulting .eml path via
//      `onDrop`. See the file-promise notes below.
//
//   2. Plain file URLs — anything dragged from Finder, Thunderbird, etc.
//      Extracts the file:// URLs from the pasteboard and reports them as
//      a batch via `onFilesDrop`. WKWebView never sees these drops because
//      this overlay sits above it; if we don't claim them here, nothing
//      else in the window will.
//
// Two promise APIs coexist for email:
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
typedef void (*desk_drop_files_cb)(const char* const* paths, size_t count,
                                   double x, double y, void* user_data);
typedef void (*desk_drop_pos_cb)(double x, double y, void* user_data);

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

// Extract plain file:// URLs from a pasteboard. Returns nil if none.
static NSArray<NSURL*>* DeskPasteboardFileUrls(NSPasteboard* pb) {
    NSArray<NSURL*>* urls = [pb readObjectsForClasses:@[ NSURL.class ]
                                              options:@{ NSPasteboardURLReadingFileURLsOnlyKey: @YES }];
    if (urls.count == 0) return nil;
    return urls;
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

typedef NS_ENUM(NSInteger, DeskDragKind) {
    DeskDragKindNone = 0,
    DeskDragKindEmail,
    DeskDragKindFiles,
};

@interface DeskEmailDropView : NSView
@property (nonatomic, copy) NSURL* destDir;
@property (nonatomic, assign) void* userData;
@property (nonatomic, assign) desk_drop_state_cb onEnter;
@property (nonatomic, assign) desk_drop_state_cb onLeave;
@property (nonatomic, assign) desk_drop_path_cb onDrop;
@property (nonatomic, assign) desk_drop_state_cb onFilesEnter;
@property (nonatomic, assign) desk_drop_state_cb onFilesLeave;
@property (nonatomic, assign) desk_drop_pos_cb onFilesOver;
@property (nonatomic, assign) desk_drop_files_cb onFilesDrop;
@property (nonatomic, assign) DeskDragKind currentKind;
@end

@implementation DeskEmailDropView

// Pass non-drag mouse events through to the WKWebView underneath.
- (NSView*)hitTest:(NSPoint)point {
    return nil;
}

- (BOOL)acceptsFirstMouse:(NSEvent*)event {
    return NO;
}

// Use flipped coordinates so converted drag points line up with DOM (origin
// top-left) and we can forward x,y straight to elementFromPoint() in JS.
- (BOOL)isFlipped {
    return YES;
}

// Returns the drag cursor position converted to flipped view-local coords
// (which match WKWebView/DOM CSS pixel coords). Caller passes by ref.
- (void)pointForDrag:(id<NSDraggingInfo>)sender x:(double*)outX y:(double*)outY {
    NSPoint loc = [self convertPoint:[sender draggingLocation] fromView:nil];
    if (outX) *outX = (double)loc.x;
    if (outY) *outY = (double)loc.y;
}

// --- NSDraggingDestination ---

- (BOOL)pasteboardHasEmail:(NSPasteboard*)pb {
    if ([pb canReadObjectForClasses:@[ NSFilePromiseReceiver.class ] options:nil]) return YES;
    if (DeskPasteboardHasLegacyPromise([pb types])) return YES;
    // The drag reached us because we register for `public.url` so Apple Mail's
    // drag routes here at all; without a file promise there's nothing to import.
    return NO;
}

- (DeskDragKind)kindForPasteboard:(NSPasteboard*)pb {
    if ([self pasteboardHasEmail:pb]) return DeskDragKindEmail;
    if (DeskPasteboardFileUrls(pb) != nil) return DeskDragKindFiles;
    return DeskDragKindNone;
}

- (NSDragOperation)draggingEntered:(id<NSDraggingInfo>)sender {
    DeskDragKind kind = [self kindForPasteboard:[sender draggingPasteboard]];
    self.currentKind = kind;
    if (kind == DeskDragKindEmail) {
        if (self.onEnter) self.onEnter(self.userData);
        return NSDragOperationCopy;
    }
    if (kind == DeskDragKindFiles) {
        if (self.onFilesEnter) self.onFilesEnter(self.userData);
        if (self.onFilesOver) {
            double x = 0, y = 0;
            [self pointForDrag:sender x:&x y:&y];
            self.onFilesOver(x, y, self.userData);
        }
        return NSDragOperationCopy;
    }
    return NSDragOperationNone;
}

// Forward cursor position during file drags so the frontend can highlight the
// target tree row under the cursor. Email drags don't need position since they
// always open in a new tab regardless of where they land.
- (NSDragOperation)draggingUpdated:(id<NSDraggingInfo>)sender {
    if (self.currentKind == DeskDragKindFiles) {
        if (self.onFilesOver) {
            double x = 0, y = 0;
            [self pointForDrag:sender x:&x y:&y];
            self.onFilesOver(x, y, self.userData);
        }
        return NSDragOperationCopy;
    }
    if (self.currentKind == DeskDragKindEmail) {
        return NSDragOperationCopy;
    }
    return NSDragOperationNone;
}

- (void)draggingExited:(id<NSDraggingInfo>)sender {
    if (self.currentKind == DeskDragKindEmail && self.onLeave) self.onLeave(self.userData);
    if (self.currentKind == DeskDragKindFiles && self.onFilesLeave) self.onFilesLeave(self.userData);
    self.currentKind = DeskDragKindNone;
}

- (BOOL)prepareForDragOperation:(id<NSDraggingInfo>)sender {
    return [self kindForPasteboard:[sender draggingPasteboard]] != DeskDragKindNone;
}

- (BOOL)performDragOperation:(id<NSDraggingInfo>)sender {
    NSPasteboard* pb = [sender draggingPasteboard];

    // --- Generic file URL path (Finder, Thunderbird, anywhere else) ---
    if (![self pasteboardHasEmail:pb]) {
        NSArray<NSURL*>* urls = DeskPasteboardFileUrls(pb);
        if (urls == nil) return NO;

        double dropX = 0, dropY = 0;
        [self pointForDrag:sender x:&dropX y:&dropY];

        if (self.onFilesLeave) self.onFilesLeave(self.userData);
        self.currentKind = DeskDragKindNone;

        if (!self.onFilesDrop) return YES;

        // Flatten to a C array of UTF8 strings. The Rust callback copies these
        // into owned Strings synchronously, so a per-string autorelease is fine.
        NSMutableArray<NSData*>* utf8s = [NSMutableArray arrayWithCapacity:urls.count];
        for (NSURL* u in urls) {
            NSString* p = [u path];
            if (!p) continue;
            const char* bytes = [p UTF8String];
            if (!bytes) continue;
            [utf8s addObject:[NSData dataWithBytes:bytes length:strlen(bytes) + 1]];
        }
        size_t count = utf8s.count;
        const char** ptrs = (const char**)malloc(sizeof(const char*) * count);
        for (size_t i = 0; i < count; i++) {
            ptrs[i] = (const char*)[utf8s[i] bytes];
        }
        self.onFilesDrop(ptrs, count, dropX, dropY, self.userData);
        free(ptrs);
        return YES;
    }

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
    self.currentKind = DeskDragKindNone;

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
    desk_drop_state_cb on_files_enter,
    desk_drop_state_cb on_files_leave,
    desk_drop_pos_cb on_files_over,
    desk_drop_files_cb on_files_drop,
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
            existing.onFilesEnter = on_files_enter;
            existing.onFilesLeave = on_files_leave;
            existing.onFilesOver = on_files_over;
            existing.onFilesDrop = on_files_drop;
            existing.userData = user_data;
            return;
        }
    }

    DeskEmailDropView* view = [[DeskEmailDropView alloc] initWithFrame:contentView.bounds];
    view.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;
    view.onEnter = on_enter;
    view.onLeave = on_leave;
    view.onDrop = on_drop;
    view.onFilesEnter = on_files_enter;
    view.onFilesLeave = on_files_leave;
    view.onFilesOver = on_files_over;
    view.onFilesDrop = on_files_drop;
    view.userData = user_data;
    view.currentKind = DeskDragKindNone;

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
    // WKWebView (which can't extract a file). Generic file URL drops (Finder,
    // Thunderbird) also come through this same type and are dispatched to the
    // file-URL branch of performDragOperation:.
    NSMutableArray<NSString*>* draggedTypes =
        [NSMutableArray arrayWithArray:[NSFilePromiseReceiver readableDraggedTypes]];
    [draggedTypes addObject:kLegacyFilesPromisePboardType];
    [draggedTypes addObject:kPromiseUrlPboardType];
    [draggedTypes addObject:kPromiseContentPboardType];
    [draggedTypes addObject:NSPasteboardTypeURL];
    [view registerForDraggedTypes:draggedTypes];

    [contentView addSubview:view positioned:NSWindowAbove relativeTo:nil];
}
