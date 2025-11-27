import { EnvEditorService } from './env-editor.service.js';

export class EnvEditorController {
    constructor() {
        this.service = new EnvEditorService();
    }

    async getEnv(req, reply) {
        try {
            const result = await this.service.getEnvVariables();
            return reply.send({
                success: true,
                data: result
            });
        } catch (error) {
            req.log?.error?.(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to load environment variables',
            });
        }
    }

    async updateEnv(req, reply) {
        try {
            const { variables } = req.body || {};

            if (!Array.isArray(variables)) {
                return reply.status(400).send({
                    success: false,
                    message: 'Invalid payload: variables must be an array',
                });
            }

            for (const v of variables) {
                if (!v || typeof v.key !== 'string') {
                    return reply.status(400).send({
                        success: false,
                        message: 'Each variable must have a string key',
                    });
                }
                if (!v.key.trim()) {
                    return reply.status(400).send({
                        success: false,
                        message: 'Environment variable key cannot be empty',
                    });
                }
            }

            await this.service.updateEnvVariables(variables);

            // Basic audit log (keys only, no values)
            const changedKeys = variables.map((v) => v.key).join(', ');
            req.log?.info?.({ keys: changedKeys }, 'Environment variables updated via monitoring dashboard');

            return reply.send({
                success: true,
                message: 'Environment variables updated successfully',
            });
        } catch (error) {
            req.log?.error?.(error);
            return reply.status(500).send({
                success: false,
                message: 'Failed to update environment variables',
            });
        }
    }
}

