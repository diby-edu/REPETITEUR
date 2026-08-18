import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OtpInput from '../OtpInput'

// Le composant est contrôlé : le parent (RegisterTutorPage, via useState)
// re-render normalement avec la nouvelle value après chaque onChange. Ici
// on vérifie simplement l'argument reçu par onChange à chaque interaction.
function renderControlled(initial = '') {
  let currentValue = initial
  const onChange = vi.fn(v => { currentValue = v })
  const utils = render(<OtpInput value={currentValue} onChange={onChange} />)
  return {
    onChange,
    getInputs: () => utils.container.querySelectorAll('input'),
    rerenderWith: (v) => utils.rerender(<OtpInput value={v} onChange={onChange} />),
    container: utils.container,
  }
}

describe('OtpInput', () => {
  it('affiche 8 cases, toutes vides au départ', () => {
    renderControlled('')
    const inputs = screen.getAllByRole('textbox')
    expect(inputs).toHaveLength(8)
    inputs.forEach(i => expect(i).toHaveValue(''))
  })

  it('permet de taper un chiffre dans la première case vide (régression : ancien bug bloquait la saisie clavier)', async () => {
    const user = userEvent.setup()
    const { onChange, getInputs } = renderControlled('')
    const inputs = getInputs()
    await user.type(inputs[0], '5')
    expect(onChange).toHaveBeenCalledWith('5')
  })

  it('déplace le focus vers la case suivante après une saisie', async () => {
    const user = userEvent.setup()
    const { getInputs } = renderControlled('')
    const inputs = getInputs()
    await user.type(inputs[0], '1')
    expect(inputs[1]).toHaveFocus()
  })

  it('permet de taper dans une case au milieu même quand les précédentes sont déjà remplies (régression : padEnd espace bloquait maxLength)', async () => {
    const user = userEvent.setup()
    const { onChange, getInputs, rerenderWith } = renderControlled('123')
    const inputs = getInputs()
    // Les 3 premières cases affichent 1, 2, 3 ; la 4e doit être réellement vide et saisissable.
    expect(inputs[3]).toHaveValue('')
    await user.type(inputs[3], '4')
    expect(onChange).toHaveBeenCalledWith('1234')
  })

  it('filtre les caractères non numériques à la saisie', async () => {
    const user = userEvent.setup()
    const { onChange, getInputs } = renderControlled('')
    const inputs = getInputs()
    await user.type(inputs[0], 'a')
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('a'))
  })

  it('backspace sur une case remplie la vide sans changer le focus', async () => {
    const user = userEvent.setup()
    const { onChange, getInputs } = renderControlled('5')
    const inputs = getInputs()
    inputs[0].focus()
    await user.keyboard('{Backspace}')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('backspace sur une case déjà vide efface et refocalise la case précédente (régression : espace = "truthy" cassait ce comportement)', async () => {
    const user = userEvent.setup()
    const { onChange, getInputs } = renderControlled('12')
    const inputs = getInputs()
    inputs[2].focus() // case vide juste après "12"
    await user.keyboard('{Backspace}')
    expect(onChange).toHaveBeenCalledWith('1')
    expect(inputs[1]).toHaveFocus()
  })

  it('coller un code complet remplit toutes les cases via un seul onChange', async () => {
    const user = userEvent.setup()
    const { onChange, container } = renderControlled('')
    await user.click(container.querySelector('input'))
    await user.paste('12345678')
    expect(onChange).toHaveBeenCalledWith('12345678')
  })

  it('coller un code contenant des espaces/tirets ne garde que les chiffres', async () => {
    const user = userEvent.setup()
    const { onChange, container } = renderControlled('')
    await user.click(container.querySelector('input'))
    await user.paste('1234-5678')
    expect(onChange).toHaveBeenCalledWith('12345678')
  })

  it('coller un code trop long (improbable) le tronque à 8 chiffres', async () => {
    const user = userEvent.setup()
    const { onChange, container } = renderControlled('')
    await user.click(container.querySelector('input'))
    await user.paste('123456789999')
    expect(onChange).toHaveBeenCalledWith('12345678')
  })

  it('accepte une prop focusColorClass personnalisée sans planter', () => {
    expect(() => renderControlled('')).not.toThrow()
    render(<OtpInput value="" onChange={() => {}} focusColorClass="focus:border-secondary" />)
    expect(screen.getAllByRole('textbox').length).toBeGreaterThan(0)
  })
})
