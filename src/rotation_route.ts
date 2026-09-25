import { ZodError } from 'zod';
import { infrai, InfraiError } from './infrai_client';
import { runHealthtechKeyRotation } from './healthtech_rotation_service';

export async function handleRotationRequest(body: unknown) {
  try {
    const result = await runHealthtechKeyRotation(infrai, body as never);
    return {
      status: 200,
      body: result
    };
  } catch (error) {
    if (error instanceof ZodError) {
      return {
        status: 400,
        body: {
          message: 'Invalid rotation request',
          issues: error.issues
        }
      };
    }

    if (error instanceof InfraiError) {
      return {
        status: error.status >= 400 && error.status < 500 ? error.status : 502,
        body: {
          message: error.message,
          code: error.code
        }
      };
    }

    throw error;
  }
}
