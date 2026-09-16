import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrandImage } from '../src/components/common/BrandImage';

describe('ativos institucionais', () => {
  it('aplica o texto alternativo institucional às duas composições', () => {
    render(
      <>
        <BrandImage orientation="horizontal" />
        <BrandImage orientation="vertical" />
      </>,
    );
    expect(
      screen.getAllByAltText('Instituto Federal do Espírito Santo — Campus Barra de São Francisco'),
    ).toHaveLength(2);
  });
});
