import { isTrackablePageView, ServeService } from './serve.service';

describe('visitor analytics filtering', () => {
  const browserRequest = {
    method: 'GET',
    query: {},
    headers: {
      accept: 'text/html',
      'sec-fetch-dest': 'document',
      'sec-fetch-mode': 'navigate',
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36',
    },
  };

  it('tracks a successful browser document navigation', () => {
    expect(isTrackablePageView(browserRequest as never, 200, 'text/html')).toBe(
      true,
    );
  });

  it.each([
    [{ ...browserRequest, query: { __kyte_preview: '1' } }, 'Kyte preview'],
    [
      {
        ...browserRequest,
        headers: { ...browserRequest.headers, 'user-agent': 'curl/8.5.0' },
      },
      'automated client',
    ],
    [
      {
        ...browserRequest,
        headers: { ...browserRequest.headers, 'sec-fetch-dest': 'script' },
      },
      'non-document request',
    ],
  ])('does not track %s', (request) => {
    expect(isTrackablePageView(request as never, 200, 'text/html')).toBe(false);
  });

  it('does not track errors or non-HTML responses', () => {
    expect(isTrackablePageView(browserRequest as never, 404, 'text/html')).toBe(
      false,
    );
    expect(
      isTrackablePageView(
        browserRequest as never,
        200,
        'application/javascript',
      ),
    ).toBe(false);
  });
});

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

  it('strips Set-Cookie without sandboxing generated site responses', async () => {
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
    expect(res.removeHeader).toHaveBeenCalledWith('X-Frame-Options');
    expect(res.setHeader).not.toHaveBeenCalledWith(
      'Content-Security-Policy',
      expect.anything(),
    );
  });
});
