const fs = require('fs');
const path = require('path');

class ContentFilterTestUtils {
  static loadScript(scriptPath) {
    const script = fs.readFileSync(scriptPath, 'utf8');
    
    const scriptWithoutInit = script.replace(
      /const \w+Filter = new (\w+ContentFilter)\(\);\s*\w+Filter\.init\(\);/,
      'global.$1 = $1;'
    );
    
    // Define VISUAL_EFFECTS in global scope for tests
    global.VISUAL_EFFECTS = {
      BLUR_RADIUS: '6px',
      GRAYSCALE_AMOUNT: '100%',
      BRIGHTNESS_LEVEL: '0.2',
      WAITING_OPACITY: '0.8',
      BLOCKED_OPACITY: '0',
      ALLOWED_OPACITY: ''
    };
    
    eval(scriptWithoutInit);
  }

  static loadHTML(fixtureName) {
    return fs.readFileSync(
      path.join(__dirname, 'fixtures', fixtureName), 
      'utf8'
    );
  }

  static setupDOM(htmlContent) {
    document.body.innerHTML = htmlContent;
  }

  static createMockAPI() {
    return {
      successResponse: (allowedItems = []) => ({
        results: allowedItems.map(allowed => ({ isAllowed: allowed }))
      }),
      
      errorResponse: (message = 'API Error') => ({
        error: message
      }),

      mixedResponse: () => ({
        results: [
          { isAllowed: true },
          { isAllowed: false },
          { isAllowed: true },
          { isAllowed: false }
        ]
      })
    };
  }

  static expectBasicElementStructure(elements) {
    elements.forEach(element => {
      expect(element.title).toBeDefined();
      expect(element.title.length).toBeGreaterThan(0);
      expect(element.container).toBeDefined();
    });
  }

  static expectFilteringAPICall(expectedTopics) {
    const calls = chrome.runtime.sendMessage.mock.calls;
    const batchCall = calls.find(call => call[0].action === 'checkItemTitlesBatch');
    
    expect(batchCall).toBeDefined();
    expect(batchCall[0]).toEqual({
      action: 'checkItemTitlesBatch',
      items: expect.arrayContaining([
        expect.objectContaining({
          index: expect.any(Number),
          title: expect.any(String),
          container: expect.any(Object)
        })
      ]),
      topics: expectedTopics
    });
  }

  static async testFilteringIntegration(filterInstance, processMethod, topics) {
    const mockAPI = this.createMockAPI();
    
    chrome.runtime.sendMessage.mockResolvedValue(
      mockAPI.successResponse([true, false, true])
    );

    await filterInstance[processMethod](topics);

    this.expectFilteringAPICall(topics);
  }

  static async testErrorHandling(filterInstance, processMethod, topics) {
    const mockAPI = this.createMockAPI();
    
    chrome.runtime.sendMessage.mockResolvedValue(
      mockAPI.errorResponse('Test API Error')
    );

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await filterInstance[processMethod](topics);

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error checking'),
      'Test API Error'
    );

    consoleSpy.mockRestore();
  }
}

module.exports = ContentFilterTestUtils;