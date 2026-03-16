/**
 * Desk Outlook Add-in Taskpane
 *
 * UI for the add-in that allows opening emails in Desk.
 */

/* global Office */

let emailData = null;

Office.onReady(function (info) {
  if (info.host === Office.HostType.Outlook) {
    loadEmailInfo();
    document.getElementById("open-btn").onclick = openInDesk;
  }
});

/**
 * Load email information and display it
 */
function loadEmailInfo() {
  const item = Office.context.mailbox.item;

  // Display from
  const fromEl = document.getElementById("email-from");
  if (item.from) {
    fromEl.textContent = item.from.displayName
      ? item.from.displayName + " <" + item.from.emailAddress + ">"
      : item.from.emailAddress;
  } else {
    fromEl.textContent = "(Unknown sender)";
  }

  // Display subject
  const subjectEl = document.getElementById("email-subject");
  subjectEl.textContent = item.subject || "(No subject)";

  // Get body and prepare email data
  item.body.getAsync(Office.CoercionType.Text, function (result) {
    if (result.status === Office.AsyncResultStatus.Succeeded) {
      emailData = {
        subject: item.subject || "(No subject)",
        from: {
          name: item.from ? item.from.displayName : "",
          email: item.from ? item.from.emailAddress : "",
        },
        body: result.value,
        date: item.dateTimeCreated
          ? item.dateTimeCreated.toISOString()
          : new Date().toISOString(),
        source: "outlook",
      };

      // Add recipients if available
      if (item.to && item.to.length > 0) {
        emailData.to = item.to.map(function (r) {
          return { name: r.displayName, email: r.emailAddress };
        });
      }

      if (item.cc && item.cc.length > 0) {
        emailData.cc = item.cc.map(function (r) {
          return { name: r.displayName, email: r.emailAddress };
        });
      }

      if (item.itemId) {
        emailData.messageId = item.itemId;
      }

      // Enable button
      document.getElementById("open-btn").disabled = false;
    } else {
      showStatus("open-status", "Failed to load email content", "error");
    }
  });
}

/**
 * Open email in Desk via deep link
 */
function openInDesk() {
  if (!emailData) {
    showStatus("open-status", "Email data not loaded", "error");
    return;
  }

  try {
    // Encode as base64
    var jsonStr = JSON.stringify(emailData);
    var base64 = btoa(unescape(encodeURIComponent(jsonStr)));
    var deepLink = "desk://email?data=" + encodeURIComponent(base64);

    // Open deep link
    window.open(deepLink, "_blank");

    showStatus("open-status", "Opened in Desk!", "success");
  } catch (error) {
    console.error("Failed to open in Desk:", error);
    showStatus("open-status", "Failed to open in Desk", "error");
  }
}

/**
 * Show status message
 */
function showStatus(elementId, message, type) {
  var statusEl = document.getElementById(elementId);
  statusEl.textContent = message;
  statusEl.className = "status " + type;

  // Auto-hide success messages after 3 seconds
  if (type === "success") {
    setTimeout(function () {
      statusEl.className = "status";
    }, 3000);
  }
}
