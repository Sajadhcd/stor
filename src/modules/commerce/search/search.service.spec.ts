import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service.js';
import { SEARCH_PROVIDER_TOKEN, SearchProvider } from './providers/search-provider.interface.js';

describe('SearchService', () => {
  let service: SearchService;
  let providerMock: jest.Mocked<SearchProvider>;

  beforeEach(async () => {
    providerMock = {
      search: jest.fn(),
      refreshProductVector: jest.fn(),
      refreshAllProductVectors: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: SEARCH_PROVIDER_TOKEN,
          useValue: providerMock,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should delegate search to the provider', async () => {
    const searchOptions = { query: 'test' };
    const mockResult = { items: [{ id: '1', score: 0.5 }], total: 1 };
    providerMock.search.mockResolvedValue(mockResult);

    const result = await service.search('tenant-1', searchOptions);
    expect(providerMock.search).toHaveBeenCalledWith('tenant-1', searchOptions);
    expect(result).toEqual(mockResult);
  });

  it('should delegate refreshProductVector to the provider', async () => {
    await service.refreshProductVector('prod-1');
    expect(providerMock.refreshProductVector).toHaveBeenCalledWith('prod-1');
  });

  it('should delegate refreshAllProductVectors to the provider', async () => {
    await service.refreshAllProductVectors('tenant-1');
    expect(providerMock.refreshAllProductVectors).toHaveBeenCalledWith('tenant-1');
  });
});
