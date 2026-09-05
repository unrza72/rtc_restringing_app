import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin } from 'better-auth/plugins'
import { tanstackStartCookies } from 'better-auth/tanstack-start'

import { prisma } from '#/db'

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' }),
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      // PENDING | APPROVED | REJECTED — new members must be approved by an admin
      status: {
        type: 'string',
        required: false,
        defaultValue: 'PENDING',
        input: false,
      },
      approvedAt: {
        type: 'date',
        required: false,
        input: false,
      },
      approvedById: {
        type: 'string',
        required: false,
        input: false,
      },
    },
  },
  plugins: [
    admin({ defaultRole: 'member', adminRoles: ['admin'] }),
    tanstackStartCookies(),
  ],
})
