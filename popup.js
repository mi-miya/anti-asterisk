const optAria = document.getElementById("opt-aria");
const optAlt = document.getElementById("opt-alt");

// 保存済みの設定を復元
chrome.storage.local.get({ cleanAriaLabel: false, cleanAlt: false }, (saved) => {
  optAria.checked = saved.cleanAriaLabel;
  optAlt.checked = saved.cleanAlt;
});

// チェック変更時に即保存
optAria.addEventListener("change", () => {
  chrome.storage.local.set({ cleanAriaLabel: optAria.checked });
});
optAlt.addEventListener("change", () => {
  chrome.storage.local.set({ cleanAlt: optAlt.checked });
});

document.getElementById("run").addEventListener("click", async () => {
  const status = document.getElementById("status");
  const cleanAriaLabel = optAria.checked;
  const cleanAlt = optAlt.checked;

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
      args: [{ cleanAriaLabel, cleanAlt }],
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
