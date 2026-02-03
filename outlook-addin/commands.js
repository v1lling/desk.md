/**
 * Desk Outlook Add-in Commands
 *
 * This file contains the command functions that are called when users
 * click the "Open in Desk" button in the Outlook ribbon.
 */

/* global Office */

Office.onReady(function () {
  // Office is ready
});

/**
 * Opens the current email in Desk via deep links
 * @param {Office.AddinCommands.Event} event - The event object from Office
 */
function openInDesk(event) {
  const item = Office.context.mailbox.item;

  console.log("[Desk Add-in] Starting email extraction...");

  // Get email body (async)
  item.body.getAsync(Office.CoercionType.Text, function (bodyResult) {
    if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
      console.error("[Desk Add-in] Failed to get email body:", bodyResult.error);
      showNotification("Error", "Failed to read email content");
      event.completed();
      return;
    }

    const body = bodyResult.value || "";
    console.log("[Desk Add-in] Email body length:", body.length);

    // Build email data object
    const emailData = {
      subject: item.subject || "(No subject)",
      from: {
        name: item.from ? item.from.displayName || "" : "",
        email: item.from ? item.from.emailAddress || "" : "",
      },
      body: body,
      date: item.dateTimeCreated
        ? item.dateTimeCreated.toISOString()
        : new Date().toISOString(),
      source: "outlook",
    };

    // Add recipients if available
    if (item.to && item.to.length > 0) {
      emailData.to = item.to.map(function (recipient) {
        return {
          name: recipient.displayName || "",
          email: recipient.emailAddress || "",
        };
      });
    }

    if (item.cc && item.cc.length > 0) {
      emailData.cc = item.cc.map(function (recipient) {
        return {
          name: recipient.displayName || "",
          email: recipient.emailAddress || "",
        };
      });
    }

    // Add message ID if available
    if (item.itemId) {
      emailData.messageId = item.itemId;
    }

    console.log("[Desk Add-in] Email data:", {
      subject: emailData.subject,
      from: emailData.from.email,
      bodyLength: emailData.body.length,
    });

    try {
      // Encode as base64 and build deep link
      const jsonStr = JSON.stringify(emailData);
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
      // URL-encode the base64 because it can contain + which becomes space in URLs
      const deepLink = "desk://email?data=" + encodeURIComponent(base64);

      console.log("[Desk Add-in] Deep link length:", deepLink.length);
      console.log("[Desk Add-in] Deep link preview:", deepLink.substring(0, 100) + "...");

      // Open deep link
      window.open(deepLink, "_blank");

      // Show success notification
      showNotification("Opened in Desk", "Email sent to Desk app");
    } catch (err) {
      console.error("[Desk Add-in] Failed to encode email:", err);
      showNotification("Error", "Failed to encode email: " + err.message);
    }

    // Signal that the function is complete
    event.completed();
  });
}

/**
 * Insert reply from Desk via clipboard
 * Reads the clipboard and opens a reply form with the content
 * @param {Office.AddinCommands.Event} event - The event object from Office
 */
async function insertReplyFromDesk(event) {
  console.log("[Desk Add-in] Starting reply insertion...");

  try {
    // Request clipboard permission and read text
    const clipboardText = await navigator.clipboard.readText();

    if (!clipboardText || clipboardText.trim() === "") {
      showNotification(
        "No Draft Found",
        "Copy a draft from Desk first, then try again."
      );
      event.completed();
      return;
    }

    console.log("[Desk Add-in] Clipboard content length:", clipboardText.length);

    // Try to parse as Desk draft format (with metadata)
    let replyBody = clipboardText;
    let replyAll = false;

    // Check for Desk draft format: <!-- DESK_REPLY:reply|replyall -->
    const deskMarkerMatch = clipboardText.match(
      /<!--\s*DESK_REPLY:(reply|replyall)\s*-->\n?/
    );
    if (deskMarkerMatch) {
      replyAll = deskMarkerMatch[1] === "replyall";
      replyBody = clipboardText.replace(deskMarkerMatch[0], "").trim();
      console.log("[Desk Add-in] Detected Desk draft, replyAll:", replyAll);
    }

    // Convert plain text to HTML for Outlook
    // Preserve line breaks and escape HTML entities
    const htmlBody = replyBody
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    // Open reply form with the draft content
    const item = Office.context.mailbox.item;

    if (replyAll) {
      item.displayReplyAllForm({
        htmlBody: htmlBody,
      });
    } else {
      item.displayReplyForm({
        htmlBody: htmlBody,
      });
    }

    showNotification("Draft Inserted", "Reply form opened with your draft.");
  } catch (err) {
    console.error("[Desk Add-in] Failed to insert reply:", err);

    // Handle clipboard permission denied
    if (err.name === "NotAllowedError") {
      showNotification(
        "Permission Denied",
        "Please allow clipboard access to insert the draft."
      );
    } else {
      showNotification("Error", "Failed to insert reply: " + err.message);
    }
  }

  event.completed();
}

/**
 * Shows a notification message to the user
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
  Office.context.mailbox.item.notificationMessages.replaceAsync(
    "desk-notification",
    {
      type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
      message: message,
      icon: "icon16",
      persistent: false,
    }
  );
}

// Register functions with Office
Office.actions = Office.actions || {};
Office.actions.associate("openInDesk", openInDesk);
Office.actions.associate("insertReplyFromDesk", insertReplyFromDesk);
