/**
 * Orbit Outlook Add-in Commands
 *
 * This file contains the command functions that are called when users
 * click the "Open in Orbit" button in the Outlook ribbon.
 */

/* global Office */

Office.onReady(function () {
  // Office is ready
});

/**
 * Opens the current email in Orbit via deep link
 * @param {Office.AddinCommands.Event} event - The event object from Office
 */
function openInOrbit(event) {
  const item = Office.context.mailbox.item;

  console.log("[Orbit Add-in] Starting email extraction...");

  // Get email body (async)
  item.body.getAsync(Office.CoercionType.Text, function (bodyResult) {
    if (bodyResult.status !== Office.AsyncResultStatus.Succeeded) {
      console.error("[Orbit Add-in] Failed to get email body:", bodyResult.error);
      showNotification("Error", "Failed to read email content");
      event.completed();
      return;
    }

    // Truncate body if too long
    // URL limit is ~2000-8000 chars depending on browser/OS
    // Base64 adds ~33% overhead, plus JSON structure ~500 chars
    // Safe limit: 3000 chars body → ~5000 char URL
    const MAX_BODY_LENGTH = 3000;
    let body = bodyResult.value || "";
    const originalLength = body.length;
    const wasTruncated = body.length > MAX_BODY_LENGTH;
    if (wasTruncated) {
      body = body.substring(0, MAX_BODY_LENGTH) + "\n\n[... Email truncated (" + originalLength + " chars) - view full email in Outlook ...]";
      console.warn("[Orbit Add-in] Email body truncated from", originalLength, "to", MAX_BODY_LENGTH, "chars");
    }

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

    console.log("[Orbit Add-in] Email data:", {
      subject: emailData.subject,
      from: emailData.from.email,
      bodyLength: emailData.body.length,
      truncated: wasTruncated,
    });

    try {
      // Encode as base64 and build deep link
      const jsonStr = JSON.stringify(emailData);
      const base64 = btoa(unescape(encodeURIComponent(jsonStr)));
      const deepLink = "orbit://email?data=" + base64;

      console.log("[Orbit Add-in] Deep link length:", deepLink.length);
      console.log("[Orbit Add-in] Deep link preview:", deepLink.substring(0, 100) + "...");

      // Open deep link
      window.open(deepLink, "_blank");

      // Show success notification
      showNotification("Opened in Orbit", wasTruncated ? "Email sent (body truncated)" : "Email sent to Orbit app");
    } catch (err) {
      console.error("[Orbit Add-in] Failed to encode email:", err);
      showNotification("Error", "Failed to encode email: " + err.message);
    }

    // Signal that the function is complete
    event.completed();
  });
}

/**
 * Shows a notification message to the user
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
  Office.context.mailbox.item.notificationMessages.replaceAsync(
    "orbit-notification",
    {
      type: Office.MailboxEnums.ItemNotificationMessageType.InformationalMessage,
      message: message,
      icon: "icon16",
      persistent: false,
    }
  );
}

// Register the function with Office
Office.actions = Office.actions || {};
Office.actions.associate("openInOrbit", openInOrbit);
