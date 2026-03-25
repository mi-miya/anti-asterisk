const optAlt = document.getElementById("opt-alt");
const optSources = document.getElementById("opt-sources");

// 保存済みの設定を復元
chrome.storage.local.get({ cleanAlt: false, removeSources: false }, (saved) => {
  optAlt.checked = saved.cleanAlt;
  optSources.checked = saved.removeSources;
});

// チェック変更時に即保存
optAlt.addEventListener("change", () => {
  chrome.storage.local.set({ cleanAlt: optAlt.checked });
});
optSources.addEventListener("change", () => {
  chrome.storage.local.set({ removeSources: optSources.checked });
});

document.getElementById("run").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const cleanAlt = optAlt.checked;
  const removeSources = optSources.checked;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    status.textContent = "対象のタブが見つかりません";
    return;
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (options) => {
        window.__antiAsteriskOptions = options;
      },
      args: [{ cleanAlt, removeSources }],
    });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    status.textContent = "削除しました!";
  } catch (e) {
    status.textContent = "このページでは実行できません";
  }
});
