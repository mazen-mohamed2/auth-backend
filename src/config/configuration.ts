import * as Joi from 'joi';

export default () => ({
  env: process.env.NODE_ENV || 'production',
  port: parseInt(process.env.PORT ?? '4000', 10),
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/auth_fullstack',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev_access_secret',
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
  },
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
});

// ✅ Use the env passed by Nest, not process.env, and return validated values.
export const validateEnv = (env: Record<string, unknown>) => {
  const schema = Joi.object({
    PORT: Joi.number().default(4000),
    // ✅ Accept MongoDB schemes (mongodb / mongodb+srv)
    MONGODB_URI: Joi.string()
      .uri({ scheme: ['mongodb', 'mongodb+srv'] })
      .required(),
    JWT_ACCESS_SECRET: Joi.string().min(16).required(),
    JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
    JWT_REFRESH_SECRET: Joi.string().min(16).required(),
    JWT_REFRESH_EXPIRES: Joi.string().default('7d'),
    CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    LOG_LEVEL: Joi.string().default('info'),
  });

  const { error, value } = schema.validate(env, { allowUnknown: true });
  if (error) throw new Error(`Config validation error: ${error.message}`);
  return value; // ✅ important
};
