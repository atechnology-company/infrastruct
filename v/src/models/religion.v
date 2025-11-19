module models

// Religion types
pub enum Religion {
	judaism
	christianity
	islam
	hinduism
	sikhism
	buddhism
}

// Status types for religious rulings
pub enum Status {
	permitted
	forbidden
	disliked
	unsure
	encouraged
	obligatory
	dharmic
	adharmic
	neutral
	skillful
	unskillful
	essential
	discouraged
}

// Source represents a religious source/citation
pub struct Source {
pub mut:
	title   string
	url     string
	snippet string
	engine  string
}

// ReligionSection represents analysis for one religion
pub struct ReligionSection {
pub mut:
	featured_quote        string
	featured_quote_source ?Source
	status                ?Status
	summary               string
	sources               []Source
}

// SearchRequest from client
pub struct SearchRequest {
pub:
	query string
}

// SearchResponse to client
pub struct SearchResponse {
pub mut:
	title       string
	sections    map[string]ReligionSection
	conclusions []Conclusion
}

// Conclusion represents a logical conclusion
pub struct Conclusion {
pub mut:
	label   string
	summary string
}

// PerplexitySearchRequest
pub struct PerplexitySearchRequest {
pub:
	query       string
	religion    string
	num_results int = 5
}

// PerplexitySearchResponse
pub struct PerplexitySearchResponse {
pub mut:
	results     []Source
	used_engine string
}
