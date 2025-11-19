module utils

import net.http

// Make HTTP GET request
pub fn http_get(url string, headers map[string]string) !string {
	mut req := http.new_request(.get, url, '') or { return error('Failed to create request') }
	
	for key, value in headers {
		req.add_header(key, value)
	}
	
	resp := req.do() or { return error('Failed to execute request') }
	
	return resp.body
}

// Make HTTP POST request
pub fn http_post(url string, body string, headers map[string]string) !string {
	mut req := http.new_request(.post, url, body) or { return error('Failed to create request') }
	
	for key, value in headers {
		req.add_header(key, value)
	}
	
	resp := req.do() or { return error('Failed to execute request') }
	
	return resp.body
}

// Get environment variable with default
pub fn get_env(key string, default_value string) string {
	value := $env(key)
	if value == '' {
		return default_value
	}
	return value
}
