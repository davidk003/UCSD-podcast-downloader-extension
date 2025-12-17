if (chrome.sidePanel && typeof chrome.sidePanel.setPanelBehavior === 'function') {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error: unknown) => {
      if (error instanceof Error) {
        console.error(error.message);
      } else {
        console.error("An unknown error occurred", error);
      }
    });
}

// Firefox sidebar
// @ts-ignore
if (chrome.sidebarAction) {
  chrome.action.onClicked.addListener(() => {
    // @ts-ignore
    chrome.sidebarAction.open();
  });
}
