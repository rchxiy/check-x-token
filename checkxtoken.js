import fetch from 'node-fetch';
import fs from 'fs/promises';
import chalk from 'chalk';

const TOKEN_FILE = 'twitter_token.txt';
const VALID_FILE = 'valid_token.txt';
const INVALID_FILE = 'invalid_token.txt';
const DELAY = 2000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkAuthToken(authToken) {
  try {
    const response = await fetch('https://twitter.com/home', {
      headers: {
        'Cookie': `auth_token=${authToken}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'manual'
    });

    // Jika redirect ke login berarti token invalid
    if ([301, 302].includes(response.status) && 
        response.headers.get('location')?.includes('login')) {
      return { valid: false, error: 'Redirect to login' };
    }

    // Cari ct0 token dalam cookie
    const cookies = response.headers.get('set-cookie') || '';
    const ct0 = cookies.match(/ct0=([^;]+)/)?.[1];

    if (!ct0) {
      return { valid: false, error: 'No ct0 token found' };
    }

    return { valid: true, ct0 };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

async function processTokens() {
  try {
    const tokens = (await fs.readFile(TOKEN_FILE, 'utf8'))
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (tokens.length === 0) {
      throw new Error('No tokens found in input file');
    }

    await fs.writeFile(VALID_FILE, '');
    await fs.writeFile(INVALID_FILE, '');

    console.log(chalk.blue.bold(`Checking ${tokens.length} auth tokens...\n`));

    for (const [index, token] of tokens.entries()) {
      if (index > 0) await sleep(DELAY);

      const { valid, error } = await checkAuthToken(token);
      const status = valid ? chalk.green('VALID') : chalk.red('INVALID');
      const tokenPreview = token.slice(0, 10) + '...';
      const errorInfo = error ? chalk.gray(` (${error})`) : '';

      console.log(`[${status}] ${chalk.cyan(tokenPreview)}${errorInfo}`);

      await fs.appendFile(valid ? VALID_FILE : INVALID_FILE, `${token}\n`);
    }

    console.log(chalk.bold('\nValidation completed!'));
    console.log(chalk.gray(`Valid tokens saved to: ${VALID_FILE}`));
    console.log(chalk.gray(`Invalid tokens saved to: ${INVALID_FILE}`));

  } catch (error) {
    console.error(chalk.red.bold(`Error: ${error.message}`));
    process.exit(1);
  }
}

(async () => {
  await processTokens();
})();