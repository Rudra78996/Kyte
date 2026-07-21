import { ServeService } from './serve.service';

describe('deployed-site hostname isolation', () => {
  const originalSitesDomain = process.env.SITES_DOMAIN;
  let service: ServeService;

  beforeEach(() => {
    process.env.SITES_DOMAIN = 'sites.example.com';
    service = new ServeService({} as never);
  });

  afterAll(() => {
    process.env.SITES_DOMAIN = originalSitesDomain;
  });

  it('resolves generated projects only below the dedicated sites domain', async () => {
    const serveFile = jest
      .spyOn(service, 'serveFile')
      .mockResolvedValue(undefined as never);
    jest
      .spyOn(service, 'serveCustomDomain')
      .mockResolvedValue(undefined as never);

    await service.serveHostname(
      'demo.sites.example.com',
      '',
      {} as never,
      {} as never,
    );

    expect(serveFile).toHaveBeenCalledWith(
      'demo',
      '',
      expect.anything(),
      expect.anything(),
    );
  });

  it('does not treat a dashboard-parent subdomain as a generated site', async () => {
    const serveFile = jest
      .spyOn(service, 'serveFile')
      .mockResolvedValue(undefined as never);
    const serveCustomDomain = jest
      .spyOn(service, 'serveCustomDomain')
      .mockResolvedValue(undefined as never);

    await service.serveHostname(
      'demo.example.com',
      '',
      {} as never,
      {} as never,
    );

    expect(serveFile).not.toHaveBeenCalled();
    expect(serveCustomDomain).toHaveBeenCalledWith(
      'demo.example.com',
      '',
      expect.anything(),
      expect.anything(),
    );
  });

  it('uses the isolated local hostname during development', async () => {
    const serveFile = jest
      .spyOn(service, 'serveFile')
      .mockResolvedValue(undefined as never);

    await service.serveHostname(
      'demo.sites.localhost',
      '',
      {} as never,
      {} as never,
    );

    expect(serveFile).toHaveBeenCalledWith(
      'demo',
      '',
      expect.anything(),
      expect.anything(),
    );
  });

  it('applies sandbox headers to generated site responses', async () => {
    const body = {
      pipe: jest.fn(),
    };
    service = new ServeService({
      project: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'project-id',
          activeDeploy: { s3Prefix: 'deployments/project-id/current' },
        }),
      },
      deployment: { findUnique: jest.fn() },
      requestLog: { create: jest.fn().mockResolvedValue(undefined) },
    } as never);
    (service as any).s3 = {
      send: jest.fn().mockResolvedValue({
        Body: body,
        ContentType: 'text/html',
      }),
    };

    const res = {
      setHeader: jest.fn(),
      removeHeader: jest.fn(),
      on: jest.fn(),
      statusCode: 200,
    };

    await service.serveFile(
      'demo',
      '',
      res as never,
      {
        method: 'GET',
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      } as never,
    );

    expect(res.removeHeader).toHaveBeenCalledWith('Set-Cookie');
    expect(res.setHeader).toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining('sandbox'),
    );
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.stringContaining('allow-same-origin'),
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      'Cross-Origin-Opener-Policy',
      'same-origin',
    );
    expect(res.setHeader).toHaveBeenCalledWith('Origin-Agent-Cluster', '?1');
  });
});
