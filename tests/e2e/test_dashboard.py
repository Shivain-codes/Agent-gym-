import asyncio
from playwright.async_api import async_playwright, expect

async def test_critical_path():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # 1. Landing Page
        await page.goto("http://localhost:5173")
        await expect(page.locator("h1")).to_contain_text("AgentGym")

        # 2. Navigate to Replay
        await page.click("text=Episode Replay")
        await expect(page.locator("h1")).to_contain_text("Episode Replay")

        # 3. Select an Episode
        # We assume there is at least one completed episode for the test to pass
        episode_card = page.locator(".group.rounded-sm.border").first
        if await episode_card.count() > 0:
            await episode_card.click()

            # 4. Verify Replay View
            await expect(page.locator("text=Step 1")).to_be_visible()

            # 5. Test Forensic Explorer
            file_link = page.locator("button.truncate").first
            if await file_link.count() > 0:
                await file_link.click()
                await expect(page.locator("text=Fetching state...")).to_be_visible()

        await browser.close()

async def main():
    try:
        await test_critical_path()
        print("E2E Test Passed: Critical Path")
    except Exception as e:
        print(f"E2E Test Failed: {e}")

if __name__ == "__main__":
    asyncio.run(main())
