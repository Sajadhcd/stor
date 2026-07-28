import { Module } from '@nestjs/common';
import { SearchService } from './search.service.js';
import { PostgresFtsProvider } from './providers/postgres-fts.provider.js';
import { SEARCH_PROVIDER_TOKEN } from './providers/search-provider.interface.js';
import { BrandRenameWorker } from './workers/brand-rename.worker.js';
import { CatalogModule } from '../catalog/catalog.module.js';

@Module({
  imports: [CatalogModule],
  providers: [
    SearchService,
    {
      provide: SEARCH_PROVIDER_TOKEN,
      useClass: PostgresFtsProvider,
    },
    BrandRenameWorker,
  ],
  exports: [SearchService],
})
export class SearchModule {}
