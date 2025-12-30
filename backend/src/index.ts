import "dotenv/config"
import Fastify, { FastifyReply, FastifyRequest } from 'fastify'

const fastify = Fastify({
    logger: true,
})

const port = parseInt(process.env.PORT!);

fastify.get("/health", async (request: FastifyRequest, reply: FastifyReply) => {
    return { up: new Date }
})
// fastify.register()

fastify.listen({ port }, (err, address) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }

    console.log(`Server running at ${address}`)
})