import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateApiKeyDto } from './create-api-key.dto';

// Helper: mirrors exactly what Nest's global ValidationPipe does when
// `transform: true` is set (see main.ts) — turn the raw body into a
// class instance (running @Transform decorators), then validate it.
async function transformAndValidate(payload: unknown) {
  const dto = plainToInstance(CreateApiKeyDto, payload);
  const errors = await validate(dto);
  return { dto, errors };
}

describe('CreateApiKeyDto', () => {
  it('accepts a valid name', async () => {
    const { errors } = await transformAndValidate({ name: 'My Server Key' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing name', async () => {
    const { errors } = await transformAndValidate({});
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects an empty string name', async () => {
    const { errors } = await transformAndValidate({ name: '' });
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects a whitespace-only name (trimmed down to empty)', async () => {
    const { dto, errors } = await transformAndValidate({ name: '    ' });
    expect(dto.name).toBe(''); // confirms the trim actually ran
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects a name shorter than 2 chars after trimming', async () => {
    const { errors } = await transformAndValidate({ name: ' a ' });
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('rejects a name longer than 32 chars', async () => {
    const { errors } = await transformAndValidate({ name: 'a'.repeat(33) });
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('accepts a name at exactly the 2-char lower boundary', async () => {
    const { errors } = await transformAndValidate({ name: 'ab' });
    expect(errors).toHaveLength(0);
  });

  it('accepts a name at exactly the 32-char upper boundary', async () => {
    const { errors } = await transformAndValidate({ name: 'a'.repeat(32) });
    expect(errors).toHaveLength(0);
  });

  it('trims surrounding whitespace so padding does not count towards the length limit', async () => {
    // 36 raw chars, but only 32 once trimmed -> should pass
    const padded = `  ${'a'.repeat(32)}  `;
    const { dto, errors } = await transformAndValidate({ name: padded });
    expect(dto.name).toBe('a'.repeat(32));
    expect(errors).toHaveLength(0);
  });

  it('rejects a non-string name', async () => {
    const { errors } = await transformAndValidate({ name: 12345 });
    expect(errors[0].constraints).toHaveProperty('isString');
  });
});
