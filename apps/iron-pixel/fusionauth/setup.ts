import * as readline from 'readline';
import chalk from 'chalk';

interface ApiConfig {
  key: string;
  endpoint: string;
  adminEmail: string;
  adminPassword: string;
  adminUserId?: string;
  name?: string;
  tenantId?: string;
  signingKeyId?: string;
}

class ApiRunner {
  constructor(private config: ApiConfig) {
    this.config.name = 'iron-pixel';

    if (!this.config.key) {
      this.config.key =
        'this_really_should_be_a_long_random_alphanumeric_value_but_this_still_works';
    }

    if (!this.config.endpoint) {
      this.config.endpoint = 'http://localhost:9011';
    }

    if (!this.config.adminEmail) {
      this.config.adminEmail = 'admin@example.com';
    }

    if (!this.config.adminPassword) {
      this.config.adminPassword = 'password';
    }

    this.config.tenantId = '';
  }

  private async tenantCreate() {
    console.log(chalk.blue('Creating tenant'));
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
        chalk.yellow('Failed to create tenant:', JSON.stringify(resp.data))
      );
      console.log(chalk.blue('Checking if tenant exists'));
      const tenantExistsResp = await this.singleApi('/api/tenant/search', {
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
      if (!tenantExistsResp.ok) {
        console.log(chalk.red('Tenant does not exist'));
        return;
      }
      console.log(
        chalk.green(
          'Tenant exists, id:',
          JSON.stringify(tenantExistsResp.data.tenants[0].id)
        )
      );
      this.config.tenantId = tenantExistsResp?.data?.tenants[0]?.id;
      return;
    }
    console.log(chalk.green('Tenant created:', resp?.data?.tenant?.id));
    this.config.tenantId = resp?.data?.tenant?.id;
  }

  private async createKey() {
    console.log(chalk.blue('Creating key'));
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
        chalk.yellow('Failed to create key:', JSON.stringify(resp.data))
      );
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
      if (!search.ok) {
        console.log(chalk.red('Key does not exist'));
        return;
      }
      console.log(
        chalk.green('Key exists, id:', JSON.stringify(search.data.keys[0].id))
      );
      this.config.signingKeyId = search?.data?.keys[0]?.id;
      return;
    }
    console.log(chalk.green('Key created:', resp?.data?.key?.id));
    this.config.signingKeyId = resp?.data?.key?.id;
  }

  private async createAdminUser() {
    console.log(chalk.blue('Creating admin user'));
    const resp = await this.singleApi('/api/user/registration', {
      method: 'POST',
      body: JSON.stringify({
        user: {
          email: this.config.adminEmail,
          password: this.config.adminPassword,
        },
        registration: {
          applicationId: '3c219e58-ed0e-4b18-ad48-f4f92793ae32', // Hate this but it's what the docs say
          roles: ['admin'],
        },
      }),
    });
    if (!resp?.data?.key?.id) {
      console.log(
        chalk.yellow('Failed to create admin user:', JSON.stringify(resp.data))
      );
      console.log(chalk.blue('Checking if admin user exists'));
      const search = await this.singleApi('/api/user/search', {
        method: 'POST',
        body: JSON.stringify({
          search: {
            queryString: this.config.adminEmail,
          },
        }),
      });
      if (!search.ok) {
        console.log(chalk.red('Admin user does not exist'));
        return;
      }
      console.log(
        chalk.green(
          'Admin user exists, id:',
          JSON.stringify(search.data.users[0].id)
        )
      );
      this.config.adminUserId = search?.data?.users[0]?.id;
      return;
    }
    console.log(chalk.green('Admin user created:', resp?.data?.key?.id));
    this.config.adminUserId = resp?.data?.key?.id;
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
          Authorization: `${this.config.key}`,
          'Content-Type': 'application/json',
        },
      };

      const allOptions = { ...defaultOptions, ...options };

      const response = await fetch(
        `${this.config.endpoint}${apiPath}`,
        allOptions
      );

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

  public async runAll() {
    console.log(chalk.green('Starting setup'));
    await this.tenantCreate();
    await this.createKey();
    await this.createAdminUser();
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
  const apiKey = await question(
    'API key(this_really_should_be_a_long_random_alphanumeric_value_but_this_still_works): '
  );
  const endpoint = await question('API endpoint (http://localhost:9011): ');
  const adminEmail = await question('Admin Email (admin@example.com): ');
  const adminPassword = await question('Admin Password (password): ');

  const runner = new ApiRunner({
    key: apiKey,
    endpoint,
    adminEmail,
    adminPassword,
  });

  await runner.runAll();

  rl.close();
}

main().catch(console.error);
