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
});
