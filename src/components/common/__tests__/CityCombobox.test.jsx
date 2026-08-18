import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CityCombobox from '../CityCombobox'
import { CITIES } from '../../../data/constants'

describe('CityCombobox', () => {
  it('affiche la valeur initiale dans le champ', () => {
    render(<CityCombobox value="Abidjan" onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/rechercher une ville/i)).toHaveValue('Abidjan')
  })

  it('au focus, sans avoir tapé, affiche TOUTES les villes (régression : ne doit pas se filtrer sur la valeur déjà sélectionnée)', async () => {
    const user = userEvent.setup()
    render(<CityCombobox value="Abidjan" onChange={() => {}} />)
    await user.click(screen.getByPlaceholderText(/rechercher une ville/i))
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(CITIES.length)
    expect(items.length).toBeGreaterThan(1)
  })

  it('filtre la liste au fur et à mesure de la saisie', async () => {
    const user = userEvent.setup()
    render(<CityCombobox value="" onChange={() => {}} />)
    const input = screen.getByPlaceholderText(/rechercher une ville/i)
    await user.type(input, 'bouak')
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBe(1)
    expect(items[0]).toHaveTextContent('Bouaké')
  })

  it('le filtre est insensible à la casse', async () => {
    const user = userEvent.setup()
    render(<CityCombobox value="" onChange={() => {}} />)
    await user.type(screen.getByPlaceholderText(/rechercher une ville/i), 'ABIDJAN')
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toContain('Abidjan')
  })

  it('une recherche sans résultat n\'affiche aucune liste (pas de crash)', async () => {
    const user = userEvent.setup()
    render(<CityCombobox value="" onChange={() => {}} />)
    await user.type(screen.getByPlaceholderText(/rechercher une ville/i), 'Villeimaginairequinexistepas')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('cliquer une ville appelle onChange avec cette ville et ferme la liste', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityCombobox value="" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText(/rechercher une ville/i), 'yamou')
    await user.click(screen.getByText('Yamoussoukro'))
    expect(onChange).toHaveBeenLastCalledWith('Yamoussoukro')
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('taper efface temporairement la sélection en amont (onChange(\'\')) tant qu\'aucune ville n\'est cliquée', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<CityCombobox value="Abidjan" onChange={onChange} />)
    await user.type(screen.getByPlaceholderText(/rechercher une ville/i), 'x')
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('reflète une valeur changée depuis le parent (reset externe)', () => {
    const { rerender } = render(<CityCombobox value="Abidjan" onChange={() => {}} />)
    rerender(<CityCombobox value="Bouaké" onChange={() => {}} />)
    expect(screen.getByPlaceholderText(/rechercher une ville/i)).toHaveValue('Bouaké')
  })

  it('gère une value vide/undefined sans planter', () => {
    expect(() => render(<CityCombobox value="" onChange={() => {}} />)).not.toThrow()
    expect(() => render(<CityCombobox value={undefined} onChange={() => {}} />)).not.toThrow()
  })
})
