import dotenv from 'dotenv';

dotenv.config();

function requireSecret(name: string, minimumLength: number): string {
  const value = process.env[name];
  if (!value || value.length < minimumLength) {
    throw new Error(`${name} must be configured with at least ${minimumLength} characters`);
  }
  return value;
}

function readPort(): number {
  const port = Number(process.env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return port;
}

export const config = Object.freeze({
  jwtSecret: requireSecret('JWT_SECRET', 32),
  port: readPort(),
});
