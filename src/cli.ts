#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import pc from 'picocolors';
import { generateWorkflow } from './workflows/generate.js';
import { ZoomBGError, NetworkError, TimeoutError, RateLimitError } from './services/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function getVersion(): Promise<string> {
  const packageJson = await readFile(
    join(__dirname, '../package.json'),
    'utf-8'
  );
  return JSON.parse(packageJson).version;
}

async function main() {
  const version = await getVersion();
  const program = new Command();

  program
    .name('vroom')
    .version(version)
    .description('Generate AI-powered Zoom backgrounds from text prompts')
    .argument('[prompt]', 'Description of the background to generate')
    .option(
      '-s, --service <name>',
      'AI service (huggingface, openai, stability)',
      'huggingface'
    )
    .option('--dry-run', 'simulate operation without saving to Zoom')
    .addHelpText('after', `

Examples:
  Generate interactively:
    $ vroom

  Generate with prompt:
    $ vroom "serene mountain landscape at sunset"

  Use specific AI service:
    $ vroom "modern office" --service openai

  Test without saving (dry-run):
    $ vroom "ocean waves" --dry-run
    (Generates and previews image, but doesn't save to Zoom)

Dry-Run Mode:
  The --dry-run flag simulates the complete workflow without:
  - Saving files to Zoom backgrounds directory
  - Persisting service preference to config
  Use this to test API keys, preview images, or validate prompts.

Documentation: https://github.com/tvellore/vroom
    `)
    .action(async (prompt, options) => {
      try {
        // Show dry-run warning upfront
        if (options.dryRun) {
          console.log(pc.yellow('Running in dry-run mode - no changes will be saved\n'));
        }

        // Validate service (research lines 624-638)
        const validServices = ['huggingface', 'openai', 'stability'];
        if (!validServices.includes(options.service)) {
          console.error(
            pc.red('Error:'),
            `Invalid service "${options.service}"`
          );
          console.error(
            pc.yellow('Valid services:'),
            validServices.join(', ')
          );
          process.exitCode = 1;
          return;
        }

        // Invoke workflow
        await generateWorkflow({
          initialPrompt: prompt,
          service: options.service,
          interactive: true,  // Phase 3 only supports interactive mode
          dryRun: options.dryRun
        });

        process.exitCode = 0;
      } catch (error) {
        handleError(error);
      }
    });

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    handleError(error);
  }
}

function handleError(error: Error | unknown): void {
  if (error instanceof NetworkError) {
    console.error(pc.red('Network Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
    console.error(pc.dim(`Error code: ${error.code}`));
    process.exitCode = 1;
  } else if (error instanceof TimeoutError) {
    console.error(pc.red('Timeout Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
    process.exitCode = 1;
  } else if (error instanceof RateLimitError) {
    console.error(pc.red('Rate Limit Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
    if (error.retryAfter) {
      console.error(pc.dim(`Retry after: ${error.retryAfter} seconds`));
    }
    process.exitCode = 1;
  } else if (error instanceof ZoomBGError) {
    console.error(pc.red('Error:'), error.message);
    console.error(pc.yellow('Solution:'), error.userMessage);
    process.exitCode = 1;
  } else if (error instanceof Error) {
    console.error(pc.red('Error:'), error.message);

    // Provide context for common errors (research lines 695-699)
    if (error.message.includes('ENOENT')) {
      console.error(pc.yellow('Suggestion:'), 'Check that all required files exist');
    } else if (error.message.includes('EACCES')) {
      console.error(pc.yellow('Suggestion:'), 'Check file permissions');
    } else if (error.message.includes('ETIMEDOUT')) {
      console.error(pc.yellow('Suggestion:'), 'Check your internet connection and try again');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error(pc.yellow('Suggestion:'), 'The service may be temporarily unavailable');
    }

    process.exitCode = 1;
  } else {
    console.error(pc.red('Unexpected error:'), error);
    process.exitCode = 1;
  }
}

// Only run if this is the entry point (research lines 717-720)
const argv1 = resolve(process.argv[1]);
if (__filename === argv1) {
  main().catch((error) => {
    console.error(pc.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { main };
