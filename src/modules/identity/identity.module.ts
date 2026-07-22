import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersService } from './users/users.service.js';
import { UsersController } from './users/users.controller.js';
import { AuthService } from './auth/auth.service.js';
import { AuthController } from './auth/auth.controller.js';
import { RefreshTokenService } from './auth/refresh-token.service.js';
import { CryptoService } from '../../security/crypto.service.js';
import { AuthGuard } from '../../security/guards/auth.guard.js';
import { PermissionsGuard } from '../../security/guards/permissions.guard.js';

@Module({
  imports: [
    JwtModule.register({}),
  ],
  controllers: [AuthController, UsersController],
  providers: [
    UsersService,
    AuthService,
    RefreshTokenService,
    CryptoService,
    AuthGuard,
    PermissionsGuard,
  ],
  exports: [
    UsersService,
    AuthService,
    RefreshTokenService,
    CryptoService,
    AuthGuard,
    PermissionsGuard,
    JwtModule,
  ],
})
export class IdentityModule {}
