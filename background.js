const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS urls (url TEXT, element TEXT,  UNIQUE(url, element))");
});

async function storagePath(path) {
    const directory = __dirname + '/screenshots/';
    return directory + path;
}

const launchBrowser = async () => {
    const browser = await puppeteer.launch({
        timeout: 60000,
        headless: process.argv.includes('--prod') ? true : false,
        args: ['--window-size=1920,1080', '--disable-notifications', '--no-sandbox'],
        defaultViewport: { width: 1920, height: 1080 }
    });
    return browser;
};

const takeScreenshot = async (query, browser) => {
    const folder = await storagePath(query.element + '/' + query.url);
    const screenshotPath = folder + '/screenshot.png';

    // Check if the screenshot already exists
    if (fs.existsSync(screenshotPath)) {
        console.log(`Screenshot already exists for: ${folder}`);
        return;
    }

    const page = await browser.newPage();

    try {
        await page.goto(query.url.startsWith('http') ? query.url : 'https://' + query.url, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForSelector(query.element, { visible: true, timeout: 5000 });
        } catch (error) {
            console.log(error);
            await page.close();
            return;
        }
        const element = await page.$(query.element);

        await page.evaluate((element) => {
            element.style.minWidth = '800px';
            element.style.minHeight = '418px';
            if (element.tagName.toLowerCase() === 'article pre') {
                element.style.display = 'flex';
                element.style.alignItems = 'center';
            }
        }, element);

        const boundingBox = await element.boundingBox();
        const screenshot = await page.screenshot({
            clip: {
                x: boundingBox.x,
                y: boundingBox.y,
                width: boundingBox.width,
                height: boundingBox.height,
            }
        });

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        fs.writeFileSync(screenshotPath, screenshot);
        console.log('Screenshot taken for: ' + folder);
    } catch (error) {
        console.log(error);
    } finally {
        try {
            await page.close();
        } catch (error) {
            console.log(error);
        }
    }
};

const rerun = async () => {
    let browser;
    try {
        db.serialize(async () => {
            try {
                const rows = await new Promise((resolve, reject) => {
                    db.all("SELECT * FROM urls limit 20", (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                });

                if (rows.length === 0) {
                    process.exit(0);
                    return;
                }

                browser = await launchBrowser();

                for (const row of rows) {
                    await takeScreenshot(row, browser);
                    await new Promise((resolve, reject) => {
                        const deleteStmt = db.prepare("DELETE FROM urls WHERE url = ? AND element = ?");
                        deleteStmt.run(row.url, row.element, (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                console.log(`Deleted url: ${row.url} and element: ${row.element}`);
                                deleteStmt.finalize();
                                resolve();
                            }
                        });
                    });
                }
                await browser.close();
            } catch (error) {
                console.error(error.message);
                if (browser) {
                    await browser.close();
                }
            }
        });
    } catch (error) {
        console.log(error.message);
        await browser.close();
    }
};

setTimeout(rerun, 1000);
