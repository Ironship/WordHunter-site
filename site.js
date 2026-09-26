// Word Hunter website: mobile menu, screenshot tabs, copy buttons, the
// download for the visitor's system, and the latest release from GitHub.
// Everything works without this script; it only adds to the static page.
(() => {
  const RELEASE_API = "https://api.github.com/repos/Ironship/WordHunter/releases/latest";
  const CACHE_KEY = "wh-latest-release";
  const CACHE_MS = 60 * 60 * 1000;

  // Mobile menu

  const menuButton = document.querySelector(".menu-button");
  const nav = document.getElementById("site-nav");
  if (menuButton && nav) {
    menuButton.hidden = false;
    nav.classList.add("is-collapsible");
    const setOpen = (open) => {
      nav.classList.toggle("is-open", open);
      menuButton.setAttribute("aria-expanded", String(open));
    };
    menuButton.addEventListener("click", () => setOpen(!nav.classList.contains("is-open")));
    nav.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) setOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        setOpen(false);
        menuButton.focus();
      }
    });
  }

  // Screenshot tabs

  const tour = document.querySelector("[data-tour]");
  const tabList = tour && tour.querySelector("[role=tablist]");
  if (tour && tabList) {
    const tabs = [...tabList.querySelectorAll("[role=tab]")];
    const panels = tabs.map((tab) => document.getElementById(tab.getAttribute("aria-controls")));
    const select = (index, focus) => {
      tabs.forEach((tab, i) => {
        const selected = i === index;
        tab.setAttribute("aria-selected", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[i].hidden = !selected;
      });
      if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => select(index, false));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
        if (next === undefined) return;
        event.preventDefault();
        select(next, true);
      });
    });
    tabList.hidden = false;
    tour.classList.add("is-enhanced");
    panels.forEach((panel) => panel.setAttribute("tabindex", "0"));
    select(0, false);
  }

  // Copy buttons for package-manager commands

  if (navigator.clipboard) {
    document.querySelectorAll(".command").forEach((command) => {
      const code = command.querySelector("code");
      if (!code) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "copy-button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", `Copy: ${code.textContent}`);
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.textContent.trim());
          button.textContent = "Copied";
        } catch {
          button.textContent = "Press Ctrl+C";
          const range = document.createRange();
          range.selectNodeContents(code);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        window.setTimeout(() => { button.textContent = "Copy"; }, 1800);
      });
      command.append(button);
    });
  }

  // The download for this visitor's system

  function detectPlatform() {
    const ua = navigator.userAgent || "";
    const hint = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || "";
    if (/android/i.test(ua)) return "android";
    if (/iphone|ipad|ipod/i.test(ua) || (/mac/i.test(hint) && navigator.maxTouchPoints > 1)) return "ios";
    if (/win/i.test(hint) || /windows/i.test(ua)) return "windows";
    if (/mac/i.test(hint) || /macintosh/i.test(ua)) return "mac";
    if (/linux|x11|cros/i.test(hint) || /linux|x11/i.test(ua)) return "linux";
    return "";
  }

  const PLATFORM_LABELS = {
    windows: ["Download for Windows", "Windows 10 and 11 · Also on macOS, Linux and Android"],
    mac: ["Download for macOS", "Apple Silicon Macs · Also on Windows, Linux and Android"],
    linux: ["Download for Linux", "Flatpak, AppImage and DEB · Also on Windows, macOS and Android"],
    android: ["Download for Android", "Word Hunter Pocket APK · Also on Windows, macOS and Linux"],
    ios: ["Get it for your computer", "Not available on iPhone or iPad yet – runs on Windows, macOS, Linux and Android"],
  };

  const platform = detectPlatform();
  const heroButton = document.querySelector("[data-os-download]");
  const heroLabel = document.querySelector("[data-os-label]");
  const heroNote = document.querySelector("[data-os-note]");
  const card = platform && document.querySelector(`.download-card[data-platform="${platform}"]`);
  if (platform && PLATFORM_LABELS[platform] && heroButton && heroLabel) {
    const [label, note] = PLATFORM_LABELS[platform];
    heroLabel.textContent = label;
    if (heroNote) heroNote.textContent = note;
    const primary = card && card.querySelector(".button-primary");
    if (primary) heroButton.href = primary.href;
  }
  if (card) card.classList.add("is-current");

  // Latest release: version numbers and versioned file names

  const ASSETS = {
    dmg: /\.dmg$/i,
    appimage: /x86_64\.AppImage$/i,
    deb: /_amd64\.deb$/i,
  };

  function applyRelease(release) {
    const version = String(release.tag_name || "").replace(/^WordHunter/, "");
    if (!/^\d+(\.\d+)+$/.test(version)) return;
    document.querySelectorAll("[data-version]").forEach((node) => { node.textContent = version; });
    if (release.html_url) {
      document.querySelectorAll("[data-release-link]").forEach((link) => { link.href = release.html_url; });
    }
    const assets = Array.isArray(release.assets) ? release.assets : [];
    document.querySelectorAll("[data-asset]").forEach((link) => {
      const pattern = ASSETS[link.dataset.asset];
      const asset = pattern && assets.find((item) => pattern.test(item.name));
      if (asset && asset.browser_download_url) link.href = asset.browser_download_url;
    });
    if (heroButton && card) {
      const primary = card.querySelector(".button-primary");
      if (primary) heroButton.href = primary.href;
    }
  }

  function readCache() {
    try {
      const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null");
      return cached && Date.now() - cached.at < CACHE_MS ? cached.release : null;
    } catch {
      return null;
    }
  }

  function writeCache(release) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), release }));
    } catch {
      // Storage can be unavailable; the page works without it.
    }
  }

  const cached = readCache();
  if (cached) {
    applyRelease(cached);
  } else if (window.fetch) {
    fetch(RELEASE_API, { headers: { Accept: "application/vnd.github+json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((release) => {
        if (!release || release.draft || release.prerelease) return;
        const slim = {
          tag_name: release.tag_name,
          html_url: release.html_url,
          assets: (release.assets || []).map((asset) => ({ name: asset.name, browser_download_url: asset.browser_download_url })),
        };
        writeCache(slim);
        applyRelease(slim);
      })
      .catch(() => {
        // Offline or rate-limited: the links in the page already point to a real release.
      });
  }
})();
