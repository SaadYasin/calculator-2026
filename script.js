(() => {
  "use strict";

  const displayEl = document.getElementById("display");
  const expressionEl = document.getElementById("expression");
  const keypadEl = document.getElementById("keypad");

  const MAX_INPUT_DIGITS = 12;
  const ERROR_MESSAGE = "Cannot divide by 0";
  const OPERATOR_SYMBOLS = {
    "+": "+",
    "-": "−",
    "*": "×",
    "/": "÷",
  };

  const state = {
    current: "0",
    previous: null,
    operator: null,
    waitingForOperand: false,
    justEvaluated: false,
    lastOperator: null,
    lastOperand: null,
    error: false,
    expression: "",
  };

  function resetState() {
    state.current = "0";
    state.previous = null;
    state.operator = null;
    state.waitingForOperand = false;
    state.justEvaluated = false;
    state.lastOperator = null;
    state.lastOperand = null;
    state.error = false;
    state.expression = "";
  }

  function countDigits(value) {
    const matches = value.match(/\d/g);
    return matches ? matches.length : 0;
  }

  function formatNumberString(value) {
    if (value === ERROR_MESSAGE) {
      return value;
    }

    if (value.includes("e") || value.includes("E")) {
      return value;
    }

    const isNegative = value.startsWith("-");
    const unsigned = isNegative ? value.slice(1) : value;
    const dotIndex = unsigned.indexOf(".");
    const integerPart = dotIndex === -1 ? unsigned : unsigned.slice(0, dotIndex);
    const fractionPart = dotIndex === -1 ? null : unsigned.slice(dotIndex + 1);
    const safeInteger = integerPart === "" ? "0" : integerPart;
    const grouped = safeInteger.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    let result = grouped;
    if (fractionPart !== null) {
      result += "." + fractionPart;
    }

    return (isNegative ? "-" : "") + result;
  }

  function toNumberString(number) {
    if (!Number.isFinite(number)) {
      return null;
    }

    if (Object.is(number, -0)) {
      return "0";
    }

    const absolute = Math.abs(number);

    if (absolute !== 0 && (absolute >= 1e12 || absolute < 1e-9)) {
      return number.toExponential(8).replace(/\.?0+e/, "e");
    }

    const rounded = Number.parseFloat(number.toPrecision(12));
    return String(rounded);
  }

  function formatValue(number) {
    const text = toNumberString(number);
    return formatNumberString(text === null ? "0" : text);
  }

  function updateDisplay() {
    const text = state.error
      ? state.current
      : formatNumberString(state.current);

    displayEl.textContent = text;
    expressionEl.textContent = state.expression || "\u00a0";
    displayEl.classList.toggle("is-error", state.error);

    // Step the font size down until the value fits the LCD.
    const sizes = ["md", "sm", "xs"];
    displayEl.dataset.size = "md";

    for (const size of sizes) {
      displayEl.dataset.size = size;

      if (displayEl.scrollWidth <= displayEl.clientWidth) {
        break;
      }
    }
  }

  function calculate(left, right, operator) {
    switch (operator) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? null : left / right;
      default:
        return null;
    }
  }

  function showError(expression = "") {
    state.current = ERROR_MESSAGE;
    state.previous = null;
    state.operator = null;
    state.waitingForOperand = false;
    state.justEvaluated = false;
    state.lastOperator = null;
    state.lastOperand = null;
    state.error = true;
    state.expression = expression;
    updateDisplay();
  }

  function inputDigit(digit) {
    if (state.error) {
      resetState();
    }

    if (state.waitingForOperand) {
      state.current = digit;
      state.waitingForOperand = false;
    } else if (state.justEvaluated) {
      resetState();
      state.current = digit;
    } else {
      if (countDigits(state.current) >= MAX_INPUT_DIGITS) {
        return;
      }

      if (state.current === "0") {
        state.current = digit;
      } else if (state.current === "-0") {
        state.current = "-" + digit;
      } else {
        state.current += digit;
      }
    }

    state.justEvaluated = false;
    updateDisplay();
  }

  function inputDecimal() {
    if (state.error) {
      resetState();
    }

    if (state.waitingForOperand) {
      state.current = "0.";
      state.waitingForOperand = false;
    } else if (state.justEvaluated) {
      resetState();
      state.current = "0.";
    } else if (!state.current.includes(".") && !state.current.includes("e")) {
      state.current += ".";
    }

    state.justEvaluated = false;
    updateDisplay();
  }

  function toggleSign() {
    if (state.error) {
      return;
    }

    if (state.waitingForOperand) {
      state.current = "0";
      state.waitingForOperand = false;
    }

    if (state.justEvaluated) {
      state.justEvaluated = false;
      state.expression = "";
    }

    if (state.current === "0") {
      state.current = "-0";
    } else if (state.current === "-0") {
      state.current = "0";
    } else if (state.current.startsWith("-")) {
      state.current = state.current.slice(1);
    } else {
      state.current = "-" + state.current;
    }

    updateDisplay();
  }

  function applyPercent() {
    if (state.error) {
      return;
    }

    if (state.waitingForOperand) {
      state.current = "0";
      state.waitingForOperand = false;
    }

    if (state.justEvaluated) {
      state.justEvaluated = false;
      state.expression = "";
    }

    const value = Number.parseFloat(state.current) || 0;
    const isAdditive =
      state.previous !== null &&
      (state.operator === "+" || state.operator === "-");
    const percentValue = isAdditive
      ? (state.previous * value) / 100
      : value / 100;
    const text = toNumberString(percentValue);

    if (text === null) {
      showError();
      return;
    }

    state.current = text;
    state.justEvaluated = false;
    updateDisplay();
  }

  function chooseOperator(nextOperator) {
    if (state.error) {
      return;
    }

    if (state.operator !== null && state.waitingForOperand) {
      state.operator = nextOperator;
      state.expression = `${formatValue(state.previous)} ${OPERATOR_SYMBOLS[nextOperator]}`;
      updateDisplay();
      return;
    }

    if (state.operator !== null && state.previous !== null) {
      const right = Number.parseFloat(state.current);
      const result = calculate(state.previous, right, state.operator);

      if (result === null || !Number.isFinite(result)) {
        showError(
          `${formatValue(state.previous)} ${OPERATOR_SYMBOLS[state.operator]} ${formatNumberString(state.current)} =`
        );
        return;
      }

      const text = toNumberString(result);

      if (text === null) {
        showError();
        return;
      }

      state.current = text;
      state.previous = Number.parseFloat(text);
    } else {
      state.previous = Number.parseFloat(state.current);

      if (!Number.isFinite(state.previous)) {
        showError();
        return;
      }
    }

    state.operator = nextOperator;
    state.waitingForOperand = true;
    state.justEvaluated = false;
    state.lastOperator = null;
    state.lastOperand = null;
    state.expression = `${formatValue(state.previous)} ${OPERATOR_SYMBOLS[nextOperator]}`;
    updateDisplay();
  }

  function evaluate() {
    if (state.error) {
      return;
    }

    if (state.operator !== null && state.previous !== null) {
      const left = state.previous;
      const right = state.waitingForOperand
        ? state.previous
        : Number.parseFloat(state.current);
      const operator = state.operator;
      const expression = `${formatValue(left)} ${OPERATOR_SYMBOLS[operator]} ${formatValue(right)} =`;
      const result = calculate(left, right, operator);

      if (result === null || !Number.isFinite(result)) {
        showError(expression);
        return;
      }

      const text = toNumberString(result);

      if (text === null) {
        showError(expression);
        return;
      }

      state.current = text;
      state.expression = expression;
      state.lastOperator = operator;
      state.lastOperand = right;
      state.previous = null;
      state.operator = null;
      state.waitingForOperand = false;
      state.justEvaluated = true;
      updateDisplay();
      return;
    }

    if (
      state.justEvaluated &&
      state.lastOperator !== null &&
      state.lastOperand !== null
    ) {
      const left = Number.parseFloat(state.current);
      const operator = state.lastOperator;
      const right = state.lastOperand;
      const expression = `${formatValue(left)} ${OPERATOR_SYMBOLS[operator]} ${formatValue(right)} =`;
      const result = calculate(left, right, operator);

      if (result === null || !Number.isFinite(result)) {
        showError(expression);
        return;
      }

      const text = toNumberString(result);

      if (text === null) {
        showError(expression);
        return;
      }

      state.current = text;
      state.expression = expression;
      state.justEvaluated = true;
      updateDisplay();
      return;
    }

    state.expression = `${formatNumberString(state.current)} =`;
    state.justEvaluated = true;
    updateDisplay();
  }

  function clearAll() {
    resetState();
    updateDisplay();
  }

  function backspace() {
    if (state.error) {
      resetState();
      updateDisplay();
      return;
    }

    if (state.waitingForOperand) {
      state.operator = null;
      state.previous = null;
      state.waitingForOperand = false;
      state.expression = "";
      updateDisplay();
      return;
    }

    if (state.justEvaluated) {
      resetState();
      updateDisplay();
      return;
    }

    if (state.current.includes("e") || state.current.includes("E")) {
      state.current = "0";
    } else {
      let next = state.current.slice(0, -1);

      if (next === "" || next === "-") {
        next = "0";
      }

      state.current = next;
    }

    updateDisplay();
  }

  function runAction(action, value) {
    switch (action) {
      case "digit":
        inputDigit(value);
        break;
      case "decimal":
        inputDecimal();
        break;
      case "operator":
        chooseOperator(value);
        break;
      case "equals":
        evaluate();
        break;
      case "clear":
        clearAll();
        break;
      case "sign":
        toggleSign();
        break;
      case "percent":
        applyPercent();
        break;
      case "backspace":
        backspace();
        break;
      default:
        break;
    }
  }

  keypadEl.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target ? target.closest("button[data-action]") : null;

    if (!button || !keypadEl.contains(button)) {
      return;
    }

    runAction(button.dataset.action, button.dataset.value);
  });

  const KEY_ACTIONS = {
    "0": ["digit", "0"],
    "1": ["digit", "1"],
    "2": ["digit", "2"],
    "3": ["digit", "3"],
    "4": ["digit", "4"],
    "5": ["digit", "5"],
    "6": ["digit", "6"],
    "7": ["digit", "7"],
    "8": ["digit", "8"],
    "9": ["digit", "9"],
    ".": ["decimal"],
    ",": ["decimal"],
    "+": ["operator", "+"],
    "-": ["operator", "-"],
    "*": ["operator", "*"],
    x: ["operator", "*"],
    X: ["operator", "*"],
    "/": ["operator", "/"],
    "%": ["percent"],
    Enter: ["equals"],
    "=": ["equals"],
    Escape: ["clear"],
    Delete: ["clear"],
    Backspace: ["backspace"],
    F9: ["sign"],
  };

  function flashButton(action, value) {
    const selector =
      value === undefined
        ? `button[data-action="${action}"]`
        : `button[data-action="${action}"][data-value="${value}"]`;
    const button = keypadEl.querySelector(selector);

    if (!button) {
      return;
    }

    button.classList.add("is-pressed");
    window.setTimeout(() => {
      button.classList.remove("is-pressed");
    }, 120);
  }

  document.addEventListener("keydown", (event) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    const activeElement = document.activeElement;

    // Let a focused button handle Enter/Space natively.
    if (
      activeElement instanceof HTMLButtonElement &&
      (event.key === "Enter" || event.key === " ")
    ) {
      return;
    }

    const action = KEY_ACTIONS[event.key];

    if (!action) {
      return;
    }

    event.preventDefault();

    const [actionName, value] = action;
    runAction(actionName, value);
    flashButton(actionName, value);
  });

  updateDisplay();
})();
