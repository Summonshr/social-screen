const puppeteer = require('puppeteer');
const md5 = require('md5');
const fs = require('fs')

function generateMd({ url, element, width, height }) {
    return md5(url + element + width + height);
}

function storagePath(path) {
    const directory = __dirname + '/screenshots/';
    return directory + path;
}

async function takeScreenshot(query) {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--window-size=1920,1080', '--disable-notifications', '--no-sandbox'],
        defaultViewport: { width: query.width || 1920, height: query.height || 1080 }
    });
    const page = await browser.newPage();
    await page.goto(query.url);
    const ulElement = await page.$(query.element || "html");
    let name = storagePath(generateMd(query) + '.png');
    await ulElement.screenshot({ path: name, clip: { width: query.width || '1920', height: query.height || '1080' } });
    await browser.close();
    return name;
}

const fastify = require('fastify')({
    logger: true
})

// Declare a route
fastify.get('/screenshot', async function (request, reply) {
    let name = storagePath(generateMd(request.query) + '.png');
    console.log(name)
    if (!fs.existsSync(name)) {
        name = await takeScreenshot(request.query);
    }
    const stream = fs.readFileSync(name);
    reply.type('image/png').header('Cache-Control', 'public, max-age=86400').send(stream);
})

// Run the server!
fastify.listen({ port: 3000 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
    // Server is now listening on ${address}
})