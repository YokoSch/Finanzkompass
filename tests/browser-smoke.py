"""Optionaler Playwright-Smoke-Test ohne Servernavigation.

In restriktiven CI-Umgebungen sind file:// und http:// verboten. Wir laden
HTML daher über set_content und mocken ausschließlich Browser-localStorage.
Anwendungscode, DOM, Formulare und Rechenlogik bleiben real.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright

HTML = Path(__file__).resolve().parent.parent / 'dist' / 'Finanzkompass.html'
html = HTML.read_text('utf-8')
storage_mock = """() => { const store = new Map(); Object.defineProperty(window,'localStorage',{
  configurable:true,value:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)}
}); }"""

def make_page(browser,width=1390,height=900):
    page=browser.new_page(viewport={'width':width,'height':height},locale='de-DE')
    page.evaluate(storage_mock)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.set_content(html,wait_until='load')
    page.set_default_timeout(3000)
    assert page.locator('h1').inner_text()=='Übersicht'
    return page,errors

def write_balance(page,amount):
    page.locator('[data-action=edit-balance]').first.click()
    page.locator('form[data-form=balance] input[name=amount]').fill(amount)
    page.locator('form[data-form=balance] button[type=submit]').click()

def add_entry(page,name,amount,date,frequency='none',income=False):
    page.locator('.top-actions [data-action="new-entry"]').click()
    form=page.locator('form[data-form=entry]')
    if income: form.locator('.segment label').nth(1).click()
    form.locator('input[name=amount]').fill(amount)
    form.locator('input[name=title]').fill(name)
    form.locator('input[name=date]').fill(date)
    form.locator('select[name=frequency]').select_option(frequency)
    form.locator('button[type=submit]').click()

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
    page,errors=make_page(browser)
    write_balance(page,'800,00')
    add_entry(page,'Miete','450','2026-11-08')
    add_entry(page,'Gehalt','2000','2026-11-15','monthly',True)
    data=page.evaluate('FinanzkompassDebug.forecast()')
    assert data['minCents']==35000,data
    assert data['safeSpendCents']==35000,data
    assert len(data['events'])==13,len(data['events']) # 1 rent + 12 salaries

    # Kalender -> Termin des Gehalts im Dez verschieben
    page.locator('.side-nav [data-view=calendar]').click()
    page.locator('[data-action=calendar-next]').click()
    page.locator('[data-action=select-day][data-date="2026-12-15"]').click()
    assert 'Gehalt' in page.locator('.calendar-side').inner_text()
    page.locator('.calendar-side [data-action=edit-event]').click()
    page.locator('form[data-form=occurrence] input[name=date]').fill('2026-12-12')
    page.locator('form[data-form=occurrence] button[type=submit]').click()
    page.locator('[data-action=select-day][data-date="2026-12-12"]').click()
    assert 'Gehalt' in page.locator('.calendar-side').inner_text()
    page.locator('[data-action=select-day][data-date="2026-12-15"]').click()
    assert 'Keine Buchungen' in page.locator('.calendar-side').inner_text()

    # Einzeltermin Dezember -> gebucht, ohne doppelten Kontenabzug
    page.locator('[data-action=select-day][data-date="2026-12-12"]').click()
    page.locator('.calendar-side [data-action=edit-event]').click()
    page.locator('[data-action=post-event]').click()
    page.locator('.scope-options .scope-option').nth(1).click()
    page.locator('form[data-form=post] button[type=submit]').click()
    st=page.evaluate('FinanzkompassDebug.state()')
    assert st['settings']['currentBalanceCents']==80000
    assert len(st['posted'])==1
    assert not any(e['date']=='2026-12-12' for e in page.evaluate('FinanzkompassDebug.forecast().events'))

    # Regeln und Suche
    page.locator('.side-nav [data-view=bookings]').click()
    assert page.locator('.rule-card').count()==2
    page.locator('#rule-search').fill('Geh')
    assert page.locator('.rule-card').count()==1
    page.locator('#rule-search').fill('')
    page.locator('[data-action=show-occurrences]').first.click()
    assert page.locator('.modal-title').inner_text()=='Einzeltermine verwalten'
    page.locator('[data-action=close-modal]').first.click()

    # Zeithorizont, Settings, Reserve, Export
    page.locator('.side-nav [data-view=settings]').click()
    page.locator('[data-action=edit-reserve]').first.click()
    page.locator('form[data-form=reserve] input[name=amount]').fill('100')
    page.locator('form[data-form=reserve] button[type=submit]').click()
    assert page.evaluate('FinanzkompassDebug.state().settings.reserveCents')==10000
    page.locator('[data-action=range-custom]').click()
    page.locator('form[data-form=range] input[name=start]').fill('2026-11-05')
    page.locator('form[data-form=range] input[name=end]').fill('2029-11-05')
    page.locator('form[data-form=range] button[type=submit]').click()
    assert page.evaluate('FinanzkompassDebug.state().settings.viewEnd')=='2029-11-05'
    page.locator('#theme-select').select_option('dark')
    assert page.evaluate('document.documentElement.dataset.theme')=='dark'
    print('Desktop smoke OK; state',page.evaluate('({rules:FinanzkompassDebug.state().rules.length, exceptions:FinanzkompassDebug.state().exceptions.length, posted:FinanzkompassDebug.state().posted.length})'))
    page.screenshot(path=str(HTML.parent/'desktop-filled.png'),full_page=True)
    assert not errors,errors

    # Mobile Responsiveness / FAB / modal
    mobile,errors2=make_page(browser,390,844)
    assert mobile.locator('.mobile-nav').is_visible()
    assert mobile.locator('.fab-mobile').is_visible()
    mobile.locator('.fab-mobile').click()
    assert mobile.locator('.modal-title').inner_text()=='Neue Buchung'
    mobile.screenshot(path=str(HTML.parent/'mobile-modal.png'),full_page=True)
    mobile.locator('[data-action=close-modal]').first.click()
    mobile.screenshot(path=str(HTML.parent/'mobile.png'),full_page=True)
    assert not errors2,errors2
    print('Mobile smoke OK')
    browser.close()
