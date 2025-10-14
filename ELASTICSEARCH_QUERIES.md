// everything
GET _search 
{
  "query": {
    "match_all": {} 
  }
}

// Wildcard search
get _search
{
  "query": {
    "wildcard": {
      "title": {
        "value" : "*cheese*"
      }
    }
  }
}

// Nested wildcard search
get _search
{
  "query": {
    "nested": {
      "path": "ingredients",
      "query": {
        "wildcard": {
          "ingredients.name": {
            "value": "*cheese*",
            "case_insensitive": true
          }
        }
      }
    }
  }
}

// Ingredient count
get _count
{
  "query": {
    "nested": {
      "path": "ingredients",
      "query": {
        "wildcard": {
          "ingredients.name": {
            "value": "*garlic*",
            "case_insensitive": true
          }
        }
      }
    }
  }
}

// Ingredient counts
get _search
{
  "size": 0,
  "aggs": {
    "total_recipes": {
      "value_count": {
        "field": "id"
      }
    },
    "ingredients_nested": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "total_ingredient_mentions": {
          "value_count": {
            "field": "ingredients.name.keyword"
          }
        },
        "unique_ingredients": {
          "cardinality": {
            "field": "ingredients.name.keyword"
          }
        },
        "top_50_ingredients": {
          "terms": {
            "field": "ingredients.name.keyword",
            "size": 50,
            "order": { "_count": "desc" }
          }
        }
      }
    }
  }
}

// Top Ingredients by Cuisine Type
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "by_cuisine": {
      "terms": {
        "field": "cuisine_type",
        "size": 10
      },
      "aggs": {
        "ingredients_nested": {
          "nested": {
            "path": "ingredients"
          },
          "aggs": {
            "top_ingredients": {
              "terms": {
                "field": "ingredients.name.keyword",
                "size": 10
              }
            }
          }
        }
      }
    }
  }
}

// Ingredient Frequency with Percentage
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "total_recipes": {
      "cardinality": {
        "field": "id"
      }
    },
    "ingredients_nested": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "unique_ingredients": {
          "cardinality": {
            "field": "ingredients.name.keyword"
          }
        },
        "top_ingredients": {
          "terms": {
            "field": "ingredients.name.keyword",
            "size": 30
          },
          "aggs": {
            "recipe_count": {
              "reverse_nested": {}
            }
          }
        }
      }
    }
  }
}

// Top 20 ingredients
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "ingredients_nested": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "top_ingredients": {
          "terms": {
            "field": "ingredients.name.keyword",
            "size": 20,
            "order": { "_count": "desc" }
          }
        }
      }
    }
  }
}

// Top Ingredients with Recipe Count
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "ingredients_nested": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "top_ingredients": {
          "terms": {
            "field": "ingredients.name.keyword",
            "size": 50
          },
          "aggs": {
            "recipes": {
              "reverse_nested": {},
              "aggs": {
                "recipe_titles": {
                  "terms": {
                    "field": "title.keyword",
                    "size": 3
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// What should I make?
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "must": [
        {
          "nested": {
            "path": "ingredients",
            "query": {
              "bool": {
                "should": [
                  { "match": { "ingredients.name": "chicken" }},
                  { "match": { "ingredients.name": "garlic" }},
                  { "match": { "ingredients.name": "rice" }}
                ]
              }
            },
            "score_mode": "sum"
          }
        }
      ]
    }
  },
  "_source": ["title", "description", "ingredients", "total_time_minutes", "difficulty"],
  "size": 10
}


// Find Similar Recipes (More Like This) 
// 
POST /recipes/_search?pretty
{
  "query": {
    "more_like_this": {
      //"fields": ["title", "description", "ingredients.name"],
      "fields": ["title"],
      "like": [
        {
          "_index": "recipes",
          "_id": "1"
        }
      ],
      "min_term_freq": 1,
      "max_query_terms": 12
    }
  }
}

// Quick recipes under 30 minutes
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "must": [
        { "term": { "difficulty": "easy" }}
      ],
      "filter": [
        { "range": { "total_time_minutes": { "lte": 30 }}}
      ]
    }
  },
  "sort": [
    { "reddit_score": { "order": "desc" }},
    { "total_time_minutes": { "order": "asc" }}
  ]
}

// Dietary tag search
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "must": [
        { "term": { "meal_type": "dinner" }},
        { "match": { "cuisine_type": "Asian" }},
        { "terms": { "dietary_tags": ["vegan"] }}
      ],
      "must_not": [
        {
          "nested": {
            "path": "ingredients",
            "query": {
              "bool": {
                "should": [
                  { "match": { "ingredients.name": "chicken" }},
                  { "match": { "ingredients.name": "beef" }},
                  { "match": { "ingredients.name": "dairy" }},
                  { "match": { "ingredients.name": "cheese" }},
                  { "match": { "ingredients.name": "egg" }}
                ]
              }
            }
          }
        }
      ]
    }
  }
}

// Popular recipes
// ** not working
POST /recipes/_search?pretty
{
  "query": {
    "function_score": {
      "query": { "match_all": {} },
      "functions": [
        {
          "field_value_factor": {
            "field": "reddit_score",
            "factor": 0.5,
            "modifier": "log1p"
          }
        },
        {
          "field_value_factor": {
            "field": "reddit_comments_count",
            "factor": 0.3,
            "modifier": "log1p"
          }
        }
      ],
      "score_mode": "sum",
      "boost_mode": "sum"
    }
  },
  "sort": [
    { "_score": { "order": "desc" }}
  ]
}

// Fuzzy search
POST /recipes/_search?pretty
{
  "query": {
    "multi_match": {
      "query": "spagetti carbonara",
      "fields": ["title^3", "description"],
      "fuzziness": "AUTO",
      "prefix_length": 2
    }
  }
}

// Weekend project recipes
// complex, high engagement
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "must": [
        { "terms": { "difficulty": ["medium", "hard"] }},
        { "range": { "reddit_comments_count": { "gte": 50 }}}
      ],
      "filter": [
        { "range": { "total_time_minutes": { "gte": 120 }}}
      ]
    }
  },
  "sort": [
    { "reddit_score": { "order": "desc" }}
  ]
}


// Ingredient count filter
// (simple recipes)
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "must": [
        { "term": { "difficulty": "easy" }}
      ]
    }
  },
  "post_filter": {
    "nested": {
      "path": "ingredients",
      "query": {
        "range": {
          "ingredients.name": {
            "gte": "",
            "lte": "zzzzzzzzz"
          }
        }
      }
    }
  },
  "aggs": {
    "ingredient_count": {
      "nested": {
        "path": "ingredients"
      },
      "aggs": {
        "count": {
          "value_count": {
            "field": "ingredients.name.keyword"
          }
        }
      }
    }
  }
}

// Multi-Field Search with Boosting
POST /recipes/_search?pretty
{
  "query": {
    "multi_match": {
      "query": "spicy thai curry",
      "fields": [
        "title^5",
        "description^2",
        "cuisine_type^3",
        "ingredients.name"
      ],
      "type": "best_fields",
      "tie_breaker": 0.3
    }
  },
  "highlight": {
    "fields": {
      "title": {},
      "description": {}
    }
  }
}

// Seasonal ingredients (Fall)
POST /recipes/_search?pretty
{
  "query": {
    "nested": {
      "path": "ingredients",
      "query": {
        "bool": {
          "should": [
            { "match": { "ingredients.name": "pumpkin" }},
            { "match": { "ingredients.name": "squash" }},
            { "match": { "ingredients.name": "apple" }},
            { "match": { "ingredients.name": "cinnamon" }}
          ],
          "minimum_should_match": 1
        }
      },
      "score_mode": "sum"
    }
  }
}

// Explain, debug scoring
// ** not working
POST /recipes/1/_explain?pretty
{
  "query": {
    "multi_match": {
      "query": "chicken curry",
      "fields": ["title", "description"]
    }
  }
}

// Recipe complexity analysis
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "by_difficulty": {
      "terms": {
        "field": "difficulty"
      },
      "aggs": {
        "avg_time": {
          "avg": { "field": "total_time_minutes" }
        },
        "avg_ingredients": {
          "nested": { "path": "ingredients" },
          "aggs": {
            "count": {
              "value_count": { "field": "ingredients.name.keyword" }
            }
          }
        },
        "avg_score": {
          "avg": { "field": "reddit_score" }
        }
      }
    }
  }
}

// Smart Recipe Discovery (Personalized)
// ingredients, cuisine, total time
POST /recipes/_search?pretty
{
  "query": {
    "bool": {
      "should": [
        {
          "nested": {
            "path": "ingredients",
            "query": {
              "terms": { "ingredients.name.keyword": ["chicken", "rice", "garlic"] }
            },
            "score_mode": "sum"
          }
        },
        {
          "match": {
            "cuisine_type": {
              "query": "Asian Italian",
              "boost": 2
            }
          }
        },
        {
          "range": {
            "total_time_minutes": {
              "gte": 15,
              "lte": 45,
              "boost": 1.5
            }
          }
        }
      ],
      "minimum_should_match": 1
    }
  },
  "min_score": 2
}

// Cuisine exploration
POST /recipes/_search?pretty
{
  "size": 0,
  "aggs": {
    "cuisines": {
      "terms": {
        "field": "cuisine_type",
        "size": 20
      },
      "aggs": {
        "sample_recipes": {
          "top_hits": {
            "size": 3,
            "sort": [{ "reddit_score": "desc" }],
            "_source": ["title", "difficulty", "total_time_minutes"]
          }
        },
        "avg_difficulty": {
          "terms": { "field": "difficulty" }
        }
      }
    }
  }
}