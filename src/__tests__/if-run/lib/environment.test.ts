/* eslint-disable @typescript-eslint/ban-ts-comment */
import {injectEnvironment} from '../../../if-run/lib/environment';

// Arboristのモック
const mockLoadActual = jest
  .fn()
  .mockImplementation(() => Promise.resolve({children: new Map()}));
jest.mock('@npmcli/arborist', () => {
  return jest.fn().mockImplementation(() => ({
    loadActual: mockLoadActual,
  }));
});

// osInfoのモック
jest.mock('../../../if-run/util/os-checker', () => ({
  osInfo: jest.fn().mockResolvedValue({
    os: 'darwin',
    'os-version': '10.15.7',
  }),
}));

// luxonのモック
jest.mock('luxon', () => ({
  DateTime: {
    local: jest.fn().mockReturnValue({
      minus: jest.fn().mockReturnValue({
        toUTC: jest.fn().mockReturnValue({
          toString: jest.fn().mockReturnValue('2021-01-01T00:00:00.000Z'),
        }),
      }),
    }),
  },
}));

// packageJsonのモックを作成
jest.mock(
  '../../../package.json',
  () => ({
    version: '0.7.2',
  }),
  {virtual: true}
);

// テスト用のデータを設定する関数
const setupTestData = (testCase: string): void => {
  if (testCase === 'true') {
    mockLoadActual.mockResolvedValueOnce({
      edgesOut: new Map([
        [
          'release-iterator',
          {
            to: {
              version: '0.7.2',
              resolved: 'git@github.com:Green-Software-Foundation/if.git',
              extraneous: false,
              overridden: false,
            },
          },
        ],
      ]),
    });
  } else {
    mockLoadActual.mockResolvedValueOnce({edgesOut: new Map()});
  }
};

describe('lib/environment: ', () => {
  describe('injectEnvironment(): ', () => {
    const context = {};

    it('checks response to have `execution` property.', async () => {
      // @ts-ignore
      const response = await injectEnvironment(context);

      expect.assertions(1);
      expect(response).toHaveProperty('execution');
    }, 6000);

    it('checks `execution` to have `command` and `environment` props.', async () => {
      // @ts-ignore
      const response = await injectEnvironment(context);
      const {execution} = response;

      expect.assertions(2);
      expect(execution).toHaveProperty('command');
      expect(execution).toHaveProperty('environment');
    });

    it('checks if dependency has github link.', async () => {
      process.env.EXECUTE = 'true';
      setupTestData('true');
      // @ts-ignore
      const response = await injectEnvironment(context);
      const {execution} = response;

      expect(execution).toHaveProperty('command');
      expect(execution?.environment).toHaveProperty('dependencies');
      expect(execution?.environment?.dependencies).toEqual([
        'release-iterator@0.7.2 (git@github.com:Green-Software-Foundation/if.git)',
      ]);

      process.env.EXECUTE = 'undefined';
    });

    it('checks if stdout do not have dependency property.', async () => {
      process.env.EXECUTE = 'invalid';
      setupTestData('invalid');
      // @ts-ignore
      const response = await injectEnvironment(context);
      const {execution} = response;

      expect(execution).toHaveProperty('command');
      expect(execution?.environment).toHaveProperty('dependencies');
      expect(execution?.environment?.dependencies).toEqual([]);

      process.env.EXECUTE = 'undefined';
    });

    it('checks environment response type.', async () => {
      // @ts-ignore
      const response = await injectEnvironment(context);
      const environment = response.execution!.environment!;

      expect(typeof environment['date-time']).toEqual('string');
      expect(Array.isArray(environment.dependencies)).toBeTruthy();
      expect(typeof environment['node-version']).toEqual('string');
      expect(typeof environment.os).toEqual('string');
      expect(typeof environment['os-version']).toEqual('string');
    });
  });
});
