import { expect, test } from "@playwright/test";

test.use({ channel: "chrome", viewport: { width: 1280, height: 900 } });

const TEST_BASE_URL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

async function dismissLocationOnboarding(page: import("@playwright/test").Page) {
  await page.getByRole("dialog", { name: "Standortzugriff" }).getByRole("button", {
    name: "Später"
  }).click();
}

test("first launch explains and requests location access", async ({ context, page }) => {
  await context.grantPermissions(["geolocation"], { origin: TEST_BASE_URL });
  await context.setGeolocation({ latitude: 52.52, longitude: 13.405, accuracy: 12 });
  await page.goto(`${TEST_BASE_URL}/?test=location-onboarding`);

  const dialog = page.getByRole("dialog", { name: "Standortzugriff" });
  await expect(dialog.getByText("Standort freigeben?")).toBeVisible();
  await dialog.getByRole("button", { name: "Standort freigeben" }).click();
  await expect(page.getByText("GPS aktiv: 12 m Genauigkeit.")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Standortzugriff" })).toHaveCount(0);
  await expect(page.locator(".seekr-live-map")).toBeVisible();
});

test("lobby buttons create a visible functional flow", async ({ page }) => {
  await page.goto(`${TEST_BASE_URL}/?test=functional`);
  await dismissLocationOnboarding(page);

  await expect(page.getByText("Noch keine Spieler")).toBeVisible();

  await page.getByRole("button", { name: "Erstellen" }).click();
  await expect(page.getByRole("button", { name: "Lobby verlassen" })).toBeVisible();
  await expect(page.getByText("Du", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Bereit?" }).click();
  await expect(page.getByText("Du bist bereit.")).toBeVisible();

  await page.getByRole("button", { name: "Rollen mischen" }).click();
  await expect(page.getByText("Rolle gesetzt")).toBeVisible();

  await expect(page.getByRole("button", { name: "Mind. 2 Spieler" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Lobby verlassen" })).toBeVisible();

  await page.getByRole("button", { name: "Hochpräzises GPS" }).click();
  await expect(page.getByText("Hochpräzises GPS: aus.")).toBeVisible();

  await page.getByRole("button", { name: "Sound-Hinweise" }).click();
  await expect(page.getByText("Sound-Hinweise: aus.")).toBeVisible();

  await page.screenshot({
    path: "/private/tmp/seekr-functional-after-clicks.png",
    fullPage: false
  });
});

test("mobile layout keeps navigation and map controls usable", async ({ page }) => {
  await page.setViewportSize({ width: 411, height: 914 });
  await page.goto(`${TEST_BASE_URL}/?test=mobile`);
  await dismissLocationOnboarding(page);

  const layout = await page.evaluate(() => {
    const nav = document.querySelector("nav");
    const map = document.querySelector(".tactical-map-bg")?.parentElement;
    const navRect = nav?.getBoundingClientRect();
    const mapRect = map?.getBoundingClientRect();

    return {
      documentWidth: document.documentElement.scrollWidth,
      mapBottom: mapRect?.bottom ?? 0,
      navPosition: nav ? getComputedStyle(nav).position : null,
      navTop: navRect?.top ?? 0,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth
    };
  });

  expect(layout.navPosition).toBe("fixed");
  expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth);
  expect(layout.mapBottom).toBeLessThanOrEqual(layout.navTop);
  expect(layout.navTop).toBeLessThan(layout.viewportHeight);

  await page.getByRole("button", { name: "Lobby", exact: true }).click();
  await page.getByLabel("Spielmodus auswählen").selectOption("Zeitjagd");
  await expect(page.getByTestId("selected-mode")).toHaveText("Zeitjagd");
  await page.getByRole("button", { name: "Erstellen", exact: true }).click();
  await expect(page.getByRole("button", { name: "Lobby verlassen" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Bereit?", exact: true })).toBeVisible();
});

test("a second client can join a realtime lobby", async ({ browser }) => {
  const hostContext = await browser.newContext({ viewport: { width: 411, height: 914 } });
  const guestContext = await browser.newContext({ viewport: { width: 411, height: 914 } });
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();

  await Promise.all([
    host.goto(`${TEST_BASE_URL}/?test=host`),
    guest.goto(`${TEST_BASE_URL}/?test=guest`)
  ]);
  await Promise.all([dismissLocationOnboarding(host), dismissLocationOnboarding(guest)]);

  await host.getByRole("button", { name: "Lobby", exact: true }).click();
  await host.getByLabel("Dein Name").fill("Host");
  await host.getByRole("button", { name: "Erstellen", exact: true }).click();
  await expect(host.getByRole("button", { name: "Lobby verlassen" })).toBeVisible();
  const code = await host.getByTestId("lobby-code").innerText();

  await guest.getByRole("button", { name: "Lobby", exact: true }).click();
  await guest.getByLabel("Dein Name").fill("Gast");
  await guest.getByRole("button", { name: "Beitreten", exact: true }).click();
  const joinDialog = guest.getByRole("dialog", { name: "Lobby beitreten" });
  await joinDialog.getByLabel("Lobby-Code").fill(code);
  await joinDialog.getByRole("button", { name: "Beitreten", exact: true }).click();

  await expect(host.locator('[data-player-name="Gast"]')).toBeVisible();
  await expect(guest.locator('[data-player-name="Host"]')).toBeVisible();
  await expect(guest.getByRole("button", { name: "Lobby verlassen" })).toBeVisible();

  await host.getByLabel("Spielmodus auswählen").selectOption("Ohne Karte");
  await expect(guest.getByTestId("selected-mode")).toHaveText("Ohne Karte");

  await host.getByRole("button", { name: "Bereit?", exact: true }).click();
  await guest.getByRole("button", { name: "Bereit?", exact: true }).click();
  await expect(host.getByRole("button", { name: "Runde starten", exact: true })).toBeEnabled();
  await host.getByRole("button", { name: "Runde starten", exact: true }).click();
  await expect(guest.getByText("Start 5", { exact: true })).toBeVisible();
  await expect(host.getByRole("button", { name: "Karte", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(guest.getByRole("button", { name: "Karte", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(host.getByTestId("map-disabled")).toBeVisible();
  await expect(guest.getByTestId("map-disabled")).toBeVisible();

  await hostContext.close();
  await guestContext.close();
});
