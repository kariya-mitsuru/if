import {DateTime} from 'luxon';
import Arborist = require('@npmcli/arborist');

import {osInfo} from '../util/os-checker';
import {Manifest} from '../../common/types/manifest';

import {STRINGS} from '../config/strings';

const packageJson = require('../../../package.json');

const {CAPTURING_RUNTIME_ENVIRONMENT_DATA} = STRINGS;

/**
 * 1. Gets the high-resolution real time when the application starts.
 * 2. Converts the high-resolution time to milliseconds.
 * 3. Gets the current DateTime.
 * 4. Subtracts the milliseconds from the current DateTime.
 */
const getProcessStartingTimestamp = () => {
  const startTime = process.hrtime();

  const [seconds, nanoseconds] = process.hrtime(startTime);
  const milliseconds = seconds * 1000 + nanoseconds / 1e6;

  const currentDateTime = DateTime.local();

  const applicationStartDateTime = currentDateTime.minus({
    milliseconds: milliseconds,
  });

  return applicationStartDateTime.toUTC().toString();
};

/**
 * Goes through the dependencies, converts them into oneliner.
 */
const convertEdge = ([packageName, edge]: [string, Arborist.Edge]) => {
  const {version, extraneous, resolved} = edge.to!;
  const ifExtraneous = extraneous ? ` extraneous -> ${resolved}` : '';
  const ifFromGithub =
    resolved && resolved.startsWith('git') ? ` (${resolved})` : '';
  return `${packageName}@${version}${ifExtraneous || ifFromGithub}`;
};

/**
 * 1. Runs `npm list --json`.
 * 2. Parses json data and converts to list.
 *
 * 注: 外部コマンドを実行せずに@npmcli/arboristを使用して依存関係情報を取得するように変更
 */
const listDependencies = async () => {
  try {
    // Arboristインスタンスを作成
    const arborist = new Arborist({path: process.cwd()});

    // 依存関係ツリーを読み込む
    const tree = await arborist.loadActual();

    return Array.from(tree.edgesOut, convertEdge).sort();
  } catch (error) {
    console.error('Error listing dependencies:', error);
    return [];
  }
};

/**
 * Injects execution information (command, environment) to existing manifest.
 */
export const injectEnvironment = async (
  manifest: Manifest
): Promise<Manifest> => {
  console.debug(CAPTURING_RUNTIME_ENVIRONMENT_DATA);

  const dependencies = await listDependencies();
  const info = await osInfo();
  const dateTime = `${getProcessStartingTimestamp()} (UTC)`;

  return {
    ...manifest,
    execution: {
      status: 'success',
      command: process.argv.join(' '),
      environment: {
        'if-version': packageJson.version,
        os: info.os,
        'os-version': info['os-version'],
        'node-version': process.versions.node,
        'date-time': dateTime,
        dependencies,
      },
    },
  };
};
