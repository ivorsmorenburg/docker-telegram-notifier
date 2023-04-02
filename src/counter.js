class Counter {
    constructor() {
      this.value = 0;
      this.lock = false;
    }
  
    increment() {
      while (this.lock); // wait for lock to be released
      this.lock = true;
      this.value++;
      this.lock = false;
    }
  
    decrement() {
      while (this.lock); // wait for lock to be released
      this.lock = true;
      this.value--;
      this.lock = false;
    }
  
    getValue() {
      return this.value;
    }
  }
  
  
  module.exports = Counter
