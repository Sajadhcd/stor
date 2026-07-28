import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { PostgresFtsProvider } from './providers/postgres-fts.provider.js';
import { SEARCH_PROVIDER_TOKEN } from './providers/search-provider.interface.js';

@Module({
  providers: [
    SearchService,
    {
      provide: SEARCH_PROVIDER_TOKEN,
      useClass: PostgresFtsProvider,
    },
  ],
  exports: [SearchService],
})
export class SearchModule {}
