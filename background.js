const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database');

db.serialize(() => {
    db.run("Drop table if exists urls");
    db.run("CREATE TABLE IF NOT EXISTS urls (url TEXT, element varchar2(255),  UNIQUE(url, element))");
});

function storagePath(path) {
    const directory = __dirname + '/screenshots/';
    return directory + path;
}

const browser = puppeteer.launch({
    headless: process.argv.includes('--prod') ? "new" : false,
    args: ['--window-size=1920,1080', '--disable-notifications', '--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
});

async function takeScreenshot(query) {
    const page = await (await browser).newPage();

    try {
        await page.goto(query.url.startsWith('http') ? query.url : 'https://' + query.url, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector(query.element, { visible: true })
        const element = await page.$(query.element);

        await page.evaluate((element) => {
            element.style['min-width'] = '800px';
            element.style['min-height'] = '418px';
            element.style['display'] = 'flex';
            element.style['align-items'] = 'center';
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

        await page.close();

        const folder = storagePath(query.element + '/' + query.url);

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        fs.writeFileSync(folder + '/screenshot.png', screenshot);
    } catch (error) {
        await page.close();
        console.log(error)
    }
}

const rerun = async function () {
    try {
        await db.serialize(async () => {
            try {
                const rows = await new Promise((resolve, reject) => {
                    db.all("SELECT * FROM urls limit 1", (err, rows) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(rows);
                        }
                    });
                });

                for await (const row of rows) {
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
                    await takeScreenshot(row);
                }

            } catch (error) {
                console.error(error.message);
            }
        });
        setTimeout(rerun, 2000);
    } catch (error) {

    }
}

setTimeout(rerun, 10000);