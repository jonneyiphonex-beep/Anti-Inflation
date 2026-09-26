const { getDictionary, getLanguageOptions, validateProductInput } = window.AntiInflationUtils || {};

function setLanguage(lang) {
  const dictionary = getDictionary ? getDictionary(lang) : {};
  const nodes = document.querySelectorAll('[data-i18n]');

  nodes.forEach((node) => {
    const key = node.getAttribute('data-i18n');
    if (dictionary[key]) {
      node.textContent = dictionary[key];
    }
  });

  const placeholderNodes = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderNodes.forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder');
    if (dictionary[key]) {
      node.setAttribute('placeholder', dictionary[key]);
    }
  });

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' || lang === 'he' ? 'rtl' : 'ltr';

  const languageSelect = document.getElementById('languageSelect');
  if (languageSelect) languageSelect.value = lang;

  const formFeedback = document.getElementById('formFeedback');
  if (formFeedback && formFeedback.dataset.state === 'error') {
    formFeedback.textContent = dictionary.required || 'Please fill in all fields';
  }
}

function updateOnlineStatus() {
  const statusText = document.getElementById('statusText');
  const netStatus = document.getElementById('netStatus');

  if (!statusText || !netStatus) return;

  const dictionary = getDictionary ? getDictionary(document.documentElement.lang || 'ar') : {};
  const isOnline = navigator.onLine;

  statusText.textContent = isOnline ? (dictionary.online || 'Online - ready to sync') : (dictionary.offline || 'Offline 100% (local storage)');
  netStatus.classList.toggle('offline', !isOnline);
  netStatus.style.borderColor = isOnline ? '#15735e' : '#a66a12';
}

window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

const languageSelect = document.getElementById('languageSelect');
if (languageSelect) {
  const supportedLanguages = getLanguageOptions ? getLanguageOptions() : [];
  if (supportedLanguages.length) {
    languageSelect.innerHTML = supportedLanguages.map((lang) => `<option value="${lang.value}">${lang.label}</option>`).join('');
  }
  languageSelect.addEventListener('change', (event) => {
    setLanguage(event.target.value);
    updateOnlineStatus();
    loadProducts();
  });
}

function showFeedback(message, type = 'error') {
  const feedback = document.getElementById('formFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.classList.remove('error', 'success');
  feedback.classList.add(type);
  feedback.dataset.state = type === 'success' ? 'success' : 'error';
}

function getLocaleFormatter(lang = document.documentElement.lang || 'ar') {
  return new Intl.NumberFormat(lang === 'ar' ? 'ar-SY' : 'en-US', { maximumFractionDigits: 2 });
}

function updateSummary(products) {
  const summaryTargets = {
    atRiskCount: null,
    stableCount: null,
    itemsCount: null
  };

  if (Array.isArray(products)) {
    const atRiskCount = products.filter((product) => product.status === 'inflation-risk').length;
    summaryTargets.atRiskCount = atRiskCount;
    summaryTargets.stableCount = products.length - atRiskCount;
    summaryTargets.itemsCount = products.length;
  }

  const formatter = getLocaleFormatter();
  Object.entries(summaryTargets).forEach(([id, value]) => {
    const target = document.getElementById(id);
    if (target) target.textContent = value === null ? '—' : formatter.format(value);
  });
}

function showTableMessage(tableBody, message, className = '') {
  const row = document.createElement('tr');
  row.className = className;
  const cell = row.insertCell();
  cell.colSpan = 5;
  cell.textContent = message;
  tableBody.replaceChildren(row);
}

async function loadProducts() {
  const tableBody = document.getElementById('itemsTable');
  if (!tableBody) return;

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('Failed to load products');

    const products = await response.json();
    updateSummary(products);
    tableBody.replaceChildren();

    const dictionary = getDictionary ? getDictionary(document.documentElement.lang || 'ar') : {};

    if (!products.length) {
      showTableMessage(tableBody, dictionary.noData || 'No data yet', 'table-message');
      return;
    }

    products.forEach((product) => {
      const row = document.createElement('tr');
      const statusClass = product.status === 'inflation-risk' ? 'danger' : 'success';
      const statusLabel = product.status === 'inflation-risk' ? (dictionary.inflationRisk || 'Inflation risk') : (dictionary.stable || 'Stable');
      const formatter = getLocaleFormatter(document.documentElement.lang || 'ar');
      const price = formatter.format(Number(product.item_price || 0));
      const weight = formatter.format(Number(product.item_weight || 0));
      const unitCost = formatter.format(Number(product.unit_cost || 0));

      const name = document.createElement('strong');
      name.textContent = product.item_name || '';
      row.insertCell().appendChild(name);
      row.insertCell().textContent = price;
      row.insertCell().textContent = weight;
      row.insertCell().textContent = unitCost;
      const status = document.createElement('span');
      status.className = `tag ${statusClass}`;
      status.textContent = statusLabel;
      row.insertCell().appendChild(status);
      tableBody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading products:', error);
    updateSummary(null);
    const dictionary = getDictionary ? getDictionary(document.documentElement.lang || 'ar') : {};
    showTableMessage(tableBody, dictionary.saveError || 'Failed to load data', 'table-message error');
  }
}

const trackerForm = document.getElementById('trackerForm');
if (trackerForm) {
  trackerForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const itemNameInput = document.getElementById('itemName');
    const itemPriceInput = document.getElementById('itemPrice');
    const itemWeightInput = document.getElementById('itemWeight');

    const itemName = itemNameInput.value.trim();
    const itemPrice = itemPriceInput.value;
    const itemWeight = itemWeightInput.value;
    const validation = validateProductInput({ itemName, itemPrice, itemWeight });
    const dict = getDictionary ? getDictionary(document.documentElement.lang || 'ar') : {};

    const fields = [itemNameInput, itemPriceInput, itemWeightInput];
    fields.forEach((field) => field.setAttribute('aria-invalid', 'false'));

    if (validation.error) {
      const message = dict[validation.error] || validation.message || 'Please fill in all fields';
      if (validation.error === 'required') {
        fields.forEach((field) => {
          if (!field.value.trim()) field.setAttribute('aria-invalid', 'true');
        });
      } else {
        [itemPriceInput, itemWeightInput].forEach((field) => field.setAttribute('aria-invalid', 'true'));
      }
      showFeedback(message, 'error');
      return;
    }

    const submitButton = trackerForm.querySelector('button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemName,
          itemPrice: Number(itemPrice),
          itemWeight: Number(itemWeight)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product');
      }

      trackerForm.reset();
      showFeedback(dict.saveSuccess || 'Data saved successfully to the database', 'success');
      await loadProducts();
    } catch (error) {
      console.error('Save failed:', error);
      showFeedback(error.message || (dict.saveError || 'Save failed'), 'error');
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });
}

setLanguage('ar');
updateOnlineStatus();
loadProducts();
