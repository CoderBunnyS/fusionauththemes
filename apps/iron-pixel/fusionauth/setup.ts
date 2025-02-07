// biome-ignore lint/style/useNodejsImportProtocol: <explanation>
import * as readline from 'readline';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
dotenv.config();

interface ApiConfig {
  apiKey: string;
  endpoint: string;
  adminEmail: string;
  adminPassword: string;
  adminUserId?: string;
  name?: string;
  tenantId?: string;
  signingKeyId?: string;
  appId?: string;
  themeId?: string;
}

interface Output {
  AUTH_FUSIONAUTH_CLIENT_ID: string;
  AUTH_FUSIONAUTH_CLIENT_SECRET: string;
  AUTH_FUSIONAUTH_TENANT_ID: string;
  AUTH_FUSIONAUTH_ISSUER: string;
  AUTH_SECRET: string;
}

class ApiRunner {
  constructor(
    private config: ApiConfig,
    private output: Output
  ) {
    if (!this.config.name) {
      console.error(
        chalk.red(
          'APP_NAME is required, please set it in .env or pass in as a parameter'
        )
      );
      process.exit(1);
    }
    this.config.name = this.config.name;

    if (!this.config.apiKey) {
      this.config.apiKey =
        'this_really_should_be_a_long_random_alphanumeric_value_but_this_still_works';
    }

    if (!this.config.endpoint) {
      this.config.endpoint = 'http://localhost:9011';
    }
    this.output.AUTH_FUSIONAUTH_ISSUER = this.config.endpoint;

    if (!this.config.adminEmail) {
      this.config.adminEmail = `admin@${this.config.name}.com`;
    }

    if (!this.config.adminPassword) {
      this.config.adminPassword = 'password';
    }

    this.config.tenantId = '';
  }
  public getEnv(): Output {
    return this.output;
  }
  private async singleApi(
    apiPath: string,
    options?: RequestInit
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
  ): Promise<{ ok: boolean; data: any }> {
    try {
      console.log(chalk.blue(`Calling API: ${apiPath}`));
      const defaultOptions: RequestInit = {
        headers: {
          Authorization: `${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
      };

      if (!apiPath.startsWith('/api/tenant/')) {
        //@ts-ignore
        defaultOptions.headers!['X-FusionAuth-TenantId'] =
          `${this.config.tenantId}`;
      }

      const allOptions = {
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options?.headers,
        },
      };

      const response = await fetch(
        `${this.config.endpoint}${apiPath}`,
        allOptions
      );

      if (options?.method === 'DELETE') {
        return {
          ok: true,
          data: null,
        };
      }

      if (response.ok) {
        return {
          ok: true,
          data: await response.json(),
        };
      }
      return {
        ok: false,
        data: await response.json(),
      };
    } catch (error) {
      console.error(chalk.red(`Error calling ${apiPath}:`), error);
      throw error;
    }
  }

  async tenantCreate() {
    console.log(chalk.blue('Checking if tenant exists'));
    const search = await this.singleApi('/api/tenant/search', {
      method: 'POST',
      body: JSON.stringify({
        search: {
          name: `${this.config.name}-tenant`,
          numberOfResults: 1,
          orderBy: 'name',
          startRow: 0,
        },
      }),
    });
    if (search?.data?.tenants[0]?.id) {
      console.log(
        chalk.green(
          'Tenant exists, id:',
          JSON.stringify(search.data.tenants[0].id)
        )
      );

      this.config.tenantId = search.data.tenants[0]?.id;
      this.output.AUTH_FUSIONAUTH_TENANT_ID = search.data.tenants[0]?.id;
      return;
    }

    console.log(chalk.blue('Tenant not found, creating tenant'));
    const resp = await this.singleApi('/api/tenant', {
      method: 'POST',
      body: JSON.stringify({
        tenant: {
          name: `${this.config.name}-tenant`,
        },
      }),
    });
    if (!resp?.data?.tenant?.id) {
      console.log(
        chalk.red('Failed to create tenant:', JSON.stringify(resp.data))
      );
      return;
    }
    console.log(chalk.green('Tenant created:', resp?.data?.tenant?.id));
    this.config.tenantId = resp?.data?.tenant?.id;
    this.output.AUTH_FUSIONAUTH_TENANT_ID = resp?.data?.tenant?.id;
  }

  async createSigningKey() {
    console.log(chalk.blue('Checking if key exists'));
    const search = await this.singleApi('/api/key/search', {
      method: 'POST',
      body: JSON.stringify({
        search: {
          name: `${this.config.name}-signing-key`,
          numberOfResults: 1,
          orderBy: 'name',
          startRow: 0,
        },
      }),
    });
    if (search?.data?.keys[0]?.id) {
      console.log(
        chalk.green('Key exists, id:', JSON.stringify(search.data.keys[0].id))
      );
      this.config.signingKeyId = search?.data?.keys[0]?.id;
      return;
    }

    console.log(chalk.blue('Key not found, Creating key'));
    const resp = await this.singleApi('/api/key/generate', {
      method: 'POST',
      body: JSON.stringify({
        key: {
          algorithm: 'RS256',
          name: `${this.config.name}-signing-key`,
          length: 2048,
        },
      }),
    });
    if (!resp?.data?.key?.id) {
      console.log(
        chalk.red('Failed to create key:', JSON.stringify(resp.data))
      );
      return;
    }
    console.log(chalk.green('Key created:', resp?.data?.key?.id));
    this.config.signingKeyId = resp?.data?.key?.id;
  }

  async addKeyToTenant() {
    console.log(chalk.blue('Adding key to tenant'));
    const resp = await this.singleApi(`/api/tenant/${this.config.tenantId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        tenant: {
          jwtConfiguration: {
            accessTokenKeyId: this.config.signingKeyId,
            idTokenKeyId: this.config.signingKeyId,
          },
        },
      }),
    });
    if (!resp?.data?.tenant?.id) {
      console.log(
        chalk.red('Failed to patch tenant:', JSON.stringify(resp.data))
      );
      return;
    }
    console.log(
      chalk.green('Tenant patched:', resp?.data?.tenant?.jwtConfiguration)
    );
  }

  async createApp() {
    console.log(chalk.blue('Checking if app exists'));
    const search = await this.singleApi('/api/application/search', {
      method: 'POST',
      body: JSON.stringify({
        search: {
          name: `${this.config.name}-app`,
        },
      }),
    });
    if (search?.data?.applications[0]?.id) {
      console.log(
        chalk.green(
          'App exists, id:',
          JSON.stringify(search.data.applications[0].id)
        )
      );
      this.config.appId = search?.data?.applications[0]?.id;
      this.output.AUTH_FUSIONAUTH_CLIENT_ID =
        search?.data?.applications[0]?.oauthConfiguration?.clientId;
      this.output.AUTH_FUSIONAUTH_CLIENT_SECRET =
        search?.data?.applications[0]?.oauthConfiguration?.clientSecret;
      return;
    }
    console.log(chalk.blue('App not found, creating app'));
    const resp = await this.singleApi('/api/application', {
      method: 'POST',
      headers: {
        'X-FusionAuth-TenantId': this.config.tenantId!,
      },
      body: JSON.stringify({
        application: {
          name: `${this.config.name}-app`,
          oauthConfiguration: {
            authorizedRedirectURLs: [
              `${this.config.endpoint}/api/auth/callback/fusionauth`,
            ],
            authorizedOriginURLs: [this.config.endpoint],
            logoutURL: this.config.endpoint,
            enabledGrants: ['authorization_code', 'refresh_token'],
            debug: true,
            generateRefreshTokens: true,
            requireRegistration: true,
          },
          jwtConfiguration: {
            enabled: true,
            accessTokenKeyId: this.config.signingKeyId,
            idTokenKeyId: this.config.signingKeyId,
          },
          registrationConfiguration: {
            enabled: true,
          },
          roles: [
            {
              name: 'admin',
            },
          ],
        },
      }),
    });
    if (!resp?.data?.application?.id) {
      console.log(
        chalk.red('Failed to create app:', JSON.stringify(resp.data))
      );
      return;
    }
    console.log(chalk.green('App created:', resp?.data?.application?.id));
    this.config.appId = resp?.data?.application?.id;
    console.log(resp?.data?.application);
    this.output.AUTH_FUSIONAUTH_CLIENT_ID =
      resp?.data?.application?.oauthConfiguration?.clientId;
    this.output.AUTH_FUSIONAUTH_CLIENT_SECRET =
      resp?.data?.application?.oauthConfiguration?.clientSecret;
  }

  async createAdminUser() {
    console.log(chalk.blue('Checking if admin user exists'));
    const search = await this.singleApi('/api/user/search', {
      method: 'POST',
      body: JSON.stringify({
        search: {
          queryString: this.config.adminEmail,
        },
      }),
    });
    if (search.data?.users[0]?.id) {
      console.log(
        chalk.green(
          'Admin user exists, id:',
          JSON.stringify(search.data.users[0].id)
        )
      );
      this.config.adminUserId = search?.data?.users[0]?.id;
      return;
    }

    console.log(chalk.blue('Admin User not found, creating admin user.'));
    const resp = await this.singleApi('/api/user/registration', {
      method: 'POST',
      body: JSON.stringify({
        user: {
          email: this.config.adminEmail,
          password: this.config.adminPassword,
        },
        registration: {
          applicationId: this.config.appId,
          roles: ['admin'],
        },
      }),
    });
    if (!resp?.data?.user?.id) {
      console.log(
        chalk.red('Failed to create admin user:', JSON.stringify(resp.data))
      );
      return;
    }
    console.log(chalk.green('Admin user created:', resp?.data?.user?.id));
    this.config.adminUserId = resp?.data?.user?.id;
  }

  async copyDefaultTheme() {
    console.log(chalk.blue('Checking if theme exists'));
    const search = await this.singleApi('/api/theme/search', {
      method: 'POST',
      body: JSON.stringify({
        search: {
          name: `${this.config.name}-theme`,
        },
      }),
    });
    if (search?.data?.themes[0]?.id) {
      console.log(
        chalk.green(
          'Theme exists, id:',
          JSON.stringify(search.data.themes[0].id)
        )
      );
      this.config.themeId = search?.data?.themes[0]?.id;
      return;
    }
    console.log(chalk.blue('Theme not found, copying default theme'));
    const resp = await this.singleApi('/api/theme', {
      method: 'POST',
      body: JSON.stringify({
        sourceThemeId: '75a068fd-e94b-451a-9aeb-3ddb9a3b5987',
        theme: {
          name: `${this.config.name}-theme`,
        },
      }),
    });
    if (!resp?.data?.theme?.id) {
      console.log(
        chalk.red('Failed to create theme:', JSON.stringify(resp.data))
      );
    }
    console.log(chalk.green('Theme created:', resp?.data?.theme?.id));
    this.config.themeId = resp?.data?.theme?.id;
  }

  async tenantDelete() {
    console.log(chalk.blue('Deleting tenant'));
    const del = await this.singleApi(`/api/tenant/${this.config.tenantId}`, {
      method: 'DELETE',
      body: JSON.stringify({
        async: false,
      }),
    });
    if (del.ok) {
      console.log(chalk.green('Tenant deleted'));
    } else {
      console.log(chalk.red('Failed to delete tenant'));
    }
  }

  async signingKeyDelete() {
    console.log(chalk.blue('Deleting key'));
    const del = await this.singleApi(`/api/key/${this.config.signingKeyId}`, {
      method: 'DELETE',
    });
    if (del.ok) {
      console.log(chalk.green('Key deleted'));
    } else {
      console.log(chalk.red('Failed to delete key'));
    }
  }

  async deleteAdminUser() {
    console.log(chalk.blue('Deleting admin user'));
    const del = await this.singleApi(`/api/user/${this.config.adminUserId}`, {
      method: 'DELETE',
    });
    if (del.ok) {
      console.log(chalk.green('Admin user deleted'));
    } else {
      console.log(chalk.red('Failed to delete admin user'));
    }
  }

  async runAll() {
    await this.tenantCreate();
    await this.createSigningKey();
    await this.addKeyToTenant();
    await this.createApp();
    await this.createAdminUser();
    await this.copyDefaultTheme();
  }

  async deleteAll() {
    await this.tenantDelete();
    await this.signingKeyDelete();
    await this.deleteAdminUser();
  }
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = (query: string): Promise<string> =>
    new Promise((resolve) => rl.question(query, resolve));

  // Get API configuration
  const name = await question(`App Name (.env: ${process.env.APP_NAME}): `);
  const apiKey = await question(
    'API key(this_really_should_be_a_long_random_alphanumeric_value_but_this_still_works): '
  );
  const endpoint = await question('API endpoint (http://localhost:9011): ');
  const adminEmail = await question('Admin Email (admin@example.com): ');
  const adminPassword = await question('Admin Password (password): ');

  console.log(chalk.blue('Starting creation'));

  const runner = new ApiRunner(
    {
      name: name || process.env.APP_NAME,
      apiKey,
      endpoint,
      adminEmail,
      adminPassword,
    },
    {
      AUTH_FUSIONAUTH_CLIENT_ID: '',
      AUTH_FUSIONAUTH_CLIENT_SECRET: '',
      AUTH_FUSIONAUTH_TENANT_ID: '',
      AUTH_FUSIONAUTH_ISSUER: '',
      AUTH_SECRET: '',
    }
  );

  await runner.runAll();

  console.log(
    chalk.bgBlack.white(
      JSON.stringify(
        {
          ...runner.getEnv(),
          AUTH_SECRET: randomString(),
        },
        null,
        2
      )
    )
  );

  const runDelete = await question('Delete Everything? (y/N) ');

  if (runDelete.toLowerCase().startsWith('y')) {
    await runner.deleteAll();
  }

  rl.close();
}

main().catch(console.error);

/** Web compatible method to create a random string of a given length */
function randomString(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  // @ts-expect-error
  return Buffer.from(bytes, 'base64').toString('base64');
}
