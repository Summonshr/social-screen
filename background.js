const puppeteer = require('puppeteer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database');

db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS urls (url TEXT, element varchar2(255),  UNIQUE(url, element))");
});

function storagePath(path) {
    const directory = __dirname + '/screenshots/';
    return directory + path;
}

const browser = puppeteer.launch({
    timeout: 60000,
    headless: process.argv.includes('--prod') ? "new" : false,
    args: ['--window-size=1920,1080', '--disable-notifications', '--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
});

async function takeScreenshot(query) {
    const folder = storagePath(query.element + '/' + query.url);
    const page = await (await browser).newPage();

    try {
        await page.goto(query.url.startsWith('http') ? query.url : 'https://' + query.url, { waitUntil: 'domcontentloaded' });
        try {
            await page.waitForSelector(query.element, { visible: true });
        } catch (error) {
	    console.log(error)
            await page.close();
	    return;
        }
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


        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        fs.writeFileSync(folder + '/screenshot.png', screenshot);
	console.log('Screenshot taken for: ' + folder)
    } catch (error) {
	console.log(error)
   }
	try {await page.close()} catch(error) {}
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
               	if(rows.length === 0) {
			process.exit(0);
	         	return;
		}

		for await (const row of rows) {
                    await takeScreenshot(row);
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

            } catch (error) {
	    console.error(error.message);
            }
        });
        setTimeout(rerun, 5000);
    } catch (error) {
        console.log(error.message)
    }
}

try {
setTimeout(rerun, 5000);
} catch(error) {
process.exit(0)	
}
