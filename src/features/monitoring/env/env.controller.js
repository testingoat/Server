import { envService } from './env.service.js';

class EnvController {
    async getEnv(req, reply) {
        try {
            const vars = await envService.getEnvVars();
            return reply.send({ success: true, data: vars });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: 'Failed to fetch environment variables' });
        }
    }

    async updateEnv(req, reply) {
        try {
            const { variables } = req.body;

            if (!Array.isArray(variables)) {
                return reply.status(400).send({ success: false, error: 'Invalid format. Expected array of variables.' });
            }

            // Basic validation
            for (const v of variables) {
                if (!v.key || typeof v.value === 'undefined') {
                    return reply.status(400).send({ success: false, error: 'Invalid variable format. Key and value required.' });
                }
            }

            await envService.saveEnvVars(variables);

            return reply.send({ success: true, message: 'Environment variables updated successfully.' });
        } catch (error) {
            req.log.error(error);
            return reply.status(500).send({ success: false, error: 'Failed to update environment variables' });
        }
    }
}

export const envController = new EnvController();
