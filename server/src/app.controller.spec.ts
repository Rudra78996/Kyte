import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return bootstrap metadata', () => {
      expect(appController.root()).toEqual({
        service: 'api',
        message: 'Deployly NestJS server is running',
      });
    });

    it('should return api health', () => {
      expect(appController.health()).toEqual({
        service: 'api',
        status: 'ok',
      });
    });
  });
});
