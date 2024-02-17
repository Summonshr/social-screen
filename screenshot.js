const puppeteer = require('puppeteer');
const fs = require('fs');
const { trimEnd } = require('lodash');
const { Statement } = require('sqlite3');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database');

db.serialize(() => {
    db.run("Drop table if exists urls");
    db.run("CREATE TABLE IF NOT EXISTS urls (url TEXT, element varchar2(255),  UNIQUE(url, element))");

    // const stmt = db.prepare("INSERT INTO lorem VALUES (?)");
    // for (let i = 0; i < 10; i++) {
    //     stmt.run("Ipsum " + i);
    // }
    // stmt.finalize();

    // db.each("SELECT rowid AS id, info FROM lorem", (err, row) => {
    //     console.log(row.id + ": " + row.info);
    // });
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
        const boundingBox = await element.boundingBox();
        const screenshot = await page.screenshot({
            clip: {
                x: boundingBox.x + 10,
                y: boundingBox.y + 10,
                width: boundingBox.width - 10,
                height: boundingBox.height - 10
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

const fastify = require('fastify')({
    logger: true
})

const rerun = async function () {
    try {
        db.serialize(async () => {
            try {
                const rows = await new Promise((resolve, reject) => {
                    db.all("SELECT * FROM urls", (err, rows) => {
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
    } catch (error) {

    }
    setTimeout(rerun, 5000);
}

setTimeout(rerun, 10000);

// Declare a route
fastify.get('/screenshots/:element/*', async function (request, reply) {
    let url = request.params['*'];

    try {
        const stmt = db.prepare("INSERT OR IGNORE INTO urls VALUES (?, ?)");
        stmt.run(trimEnd(url, 'screenshot.png'), request.params.element);
        stmt.run(trimEnd(url, 'screenshot.png'), 'html');
        stmt.run(trimEnd(url, 'screenshot.png'), 'body');
        stmt.run(trimEnd(url, 'screenshot.png'), 'article');
        stmt.run(trimEnd(url, 'screenshot.png'), 'pre');
        stmt.run(trimEnd(url, 'screenshot.png'), 'a');
        stmt.finalize();
    } catch (error) {
        console.log(error)
    }
    reply
        .send({ 'message': "Added to queue" });
})

// Run the server!
fastify.listen({ port: 3000 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    // Server is now listening on ${address}
})