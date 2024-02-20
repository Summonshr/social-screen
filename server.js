const { trimEnd } = require('lodash');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database');

const fastify = require('fastify')({
    logger: true
})

// Declare a route
fastify.get('/screenshots/:element/*', async function (request, reply) {
    let url = request.params['*'];

    try {
        const stmt = db.prepare("INSERT OR IGNORE INTO urls VALUES (?, ?)");
        stmt.run(trimEnd(url, 'screenshot.png'), request.params.element);
        stmt.finalize();
    } catch (error) {
        console.log(error)
    }
    reply
        .send({ 'message': "Added to queue" });
})

fastify.post('/bulk', async function (request, reply) {
    try {
        const stmt = db.prepare("INSERT OR IGNORE INTO urls VALUES (?, ?)");

        request.body.screens.forEach(row => {
            stmt.run(row.url, row.element);
        });
        
        stmt.finalize();

    } catch (error) {
        console.log(error)
    }
    reply
        .send({ 'message': "Added to queue" });
})

fastify.listen({ port: 3000 }, function (err, address) {
    if (err) {
        fastify.log.error(err)
        process.exit(1)
    }
})