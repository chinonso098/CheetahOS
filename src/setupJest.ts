// The bare 'jest-preset-angular' package entry pulls ts-jest's config-set into
// the sandbox, where its digest-file read resolves outside the project.
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import './jestGlobalMocks';

setupZoneTestEnv();