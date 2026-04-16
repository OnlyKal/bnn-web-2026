/**
 * Debounce Utility
 * Delays function execution until specified time has passed without new calls
 * Useful for search inputs, window resizing, etc.
 */

/**
 * Create a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced function
 * 
 * @example
 * const debouncedSearch = debounce((query) => {
 *     // console.log('Searching:', query);
 * }, 500);
 * 
 * searchInput.addEventListener('input', (e) => {
 *     debouncedSearch(e.target.value);
 * });
 */
export const debounce = (func, delay = 300) => {
    let timeoutId;
    
    const debounced = (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func(...args);
        }, delay);
    };
    
    // Allow manual cancel
    debounced.cancel = () => {
        clearTimeout(timeoutId);
    };
    
    return debounced;
};

/**
 * Create a throttled version of a function
 * Ensures function is called at most once per specified interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 * 
 * @example
 * const throttledScroll = throttle(() => {
 *     // console.log('Scrolling');
 * }, 1000);
 * 
 * window.addEventListener('scroll', throttledScroll);
 */
export const throttle = (func, limit = 300) => {
    let inThrottle;
    
    return (...args) => {
        if (!inThrottle) {
            func(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
};

/**
 * Create a debounced async function (promises-aware)
 * Waits for the specified delay before executing, cancels previous pending calls
 * @param {Function} asyncFunc - Async function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} Debounced async function
 */
export const debounceAsync = (asyncFunc, delay = 300) => {
    let timeoutId;
    let lastPromise = Promise.resolve();
    
    const debounced = async (...args) => {
        clearTimeout(timeoutId);
        
        return new Promise((resolve, reject) => {
            timeoutId = setTimeout(async () => {
                try {
                    const result = await asyncFunc(...args);
                    lastPromise = Promise.resolve(result);
                    resolve(result);
                } catch (error) {
                    lastPromise = Promise.reject(error);
                    reject(error);
                }
            }, delay);
        });
    };
    
    debounced.cancel = () => {
        clearTimeout(timeoutId);
    };
    
    return debounced;
};

export default {
    debounce,
    throttle,
    debounceAsync
};
