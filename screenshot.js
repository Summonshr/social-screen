const puppeteer = require('puppeteer');
const fs = require('fs');
const { trimEnd } = require('lodash');

function storagePath(path) {
    const directory = __dirname + '/screenshots/';
    return directory + path;
}

const browser = puppeteer.launch({
    headless: process.argv.includes('--prod') ? "new" : false,
    args: ['--window-size=1920,1080', '--disable-notifications', '--no-sandbox'],
    defaultViewport: { width: 1920, height: 1080 }
});

async function takeScreenshot(query, imageName) {
    try {
        const page = await (await browser).newPage();
        await page.goto(query.url.startsWith('http') ? query.url : 'https://' + query.url);
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

        const folder = storagePath(query.element + '/' + query.url);

        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }

        fs.writeFileSync(folder + '/screenshot.png', screenshot);
        page.close();
        return screenshot;
    } catch (error) {
        console.log(error)
    }
}

const fastify = require('fastify')({
    logger: true
})

let screenshots = [];


const rerun = async function () {
    try {
        if (screenshots.length > 0) {
            await takeScreenshot(screenshots.pop());
        }
    } catch (error) {

    }
    setTimeout(rerun, 5000);
}

setTimeout(rerun, 10000);

// Declare a route
fastify.get('/screenshots/:element/*', async function (request, reply) {
    let url = request.params['*'];
    screenshots.push({ url: trimEnd(url, 'screenshot.png'), element: request.params.element })
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